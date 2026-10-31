"""Security integration tests use only an isolated in-memory session database."""
import ast
import json
import sys
import unittest
from contextlib import nullcontext
from datetime import timedelta
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, MagicMock, patch

from django.conf import settings
if not settings.configured:
    settings.configure(SECRET_KEY='isolated-session-test-key', USE_TZ=True,
        DATABASES={'default': {'ENGINE': 'django.db.backends.sqlite3', 'NAME': ':memory:'}},
        INSTALLED_APPS=['django.contrib.sessions'], ROOT_URLCONF=__name__, ALLOWED_HOSTS=['testserver'],
        MIDDLEWARE=['django.contrib.sessions.middleware.SessionMiddleware', 'django.middleware.csrf.CsrfViewMiddleware'])
import django
django.setup()
from django.contrib.sessions.models import Session
from django.contrib.sessions.backends.db import SessionStore
from django.db import connection
from django.http import HttpResponse
from django.test import Client, RequestFactory
from django.urls import path
from django.utils import timezone
from core import account_sessions as api

urlpatterns = [path('sessions/', api.account_sessions_api), path('logout/', api.account_sessions_logout_api)]


class SessionSecurityTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        assert settings.DATABASES['default']['NAME'] == ':memory:', 'Tests must never use the live database'
        with connection.schema_editor() as editor:
            editor.create_model(Session)
        with connection.cursor() as cur:
            cur.execute('CREATE TABLE mobile_push_tokens (token TEXT PRIMARY KEY, student_id TEXT)')

    @classmethod
    def tearDownClass(cls):
        with connection.schema_editor() as editor:
            editor.delete_model(Session)
        with connection.cursor() as cur:
            cur.execute('DROP TABLE mobile_push_tokens')

    def setUp(self):
        Session.objects.all().delete()
        with connection.cursor() as cur:
            cur.execute('DELETE FROM mobile_push_tokens')
        self.factory = RequestFactory()

    def store(self, identity='alice', **extra):
        store = SessionStore()
        store.update({'student_id': identity, 'role': 'student', **extra})
        store.save()
        return store

    def request(self, store=None, data=None, method='GET'):
        req = self.factory.generic(method, '/api/mobile/account/sessions/',
            data=json.dumps(data or {}), content_type='application/json',
            HTTP_USER_AGENT='ELECOM-Mobile (android)', HTTP_X_ELECOM_DEVICE='itel A667LP', REMOTE_ADDR='203.0.113.9')
        req.session = store or self.store()
        return req

    def body(self, response):
        return json.loads(response.content)

    def test_listing_never_exposes_other_accounts_or_bearer_keys(self):
        mine = self.store()
        other = self.store('bob')
        response = self.body(api.account_sessions_api(self.request(mine)))
        self.assertEqual(len(response['sessions']), 1)
        item = response['sessions'][0]
        self.assertTrue(item['is_current'])
        self.assertNotIn(mine.session_key, json.dumps(response))
        self.assertNotIn(other.session_key, json.dumps(response))

    def test_legacy_session_is_visible_without_invented_details(self):
        item = self.body(api.account_sessions_api(self.request()))['sessions'][0]
        self.assertIsNone(item['signed_in_at'])
        self.assertIsNone(item['last_active_at'])

    def test_expired_sessions_are_excluded(self):
        old = self.store()
        Session.objects.filter(session_key=old.session_key).update(expire_date=timezone.now() - timedelta(seconds=1))
        self.assertEqual(len(self.body(api.account_sessions_api(self.request()))['sessions']), 1)

    def test_one_device_logout_leaves_current_and_other_users_intact(self):
        current, target, other = self.store(), self.store(), self.store('bob')
        response = self.body(api.account_sessions_logout_api(self.request(current,
            {'session_id': api._opaque_id(target.session_key)}, 'POST')))
        self.assertFalse(response['current_session_ended'])
        self.assertFalse(Session.objects.filter(session_key=target.session_key).exists())
        self.assertTrue(Session.objects.filter(session_key=current.session_key).exists())
        self.assertTrue(Session.objects.filter(session_key=other.session_key).exists())

    def test_cannot_revoke_another_users_session_even_with_its_opaque_id(self):
        other = self.store('bob')
        response = api.account_sessions_logout_api(self.request(data={'session_id': api._opaque_id(other.session_key)}, method='POST'))
        self.assertEqual(response.status_code, 404)
        self.assertTrue(Session.objects.filter(session_key=other.session_key).exists())

    def test_logout_all_revokes_legacy_and_current_but_not_other_users(self):
        current, legacy, other = self.store(), self.store(), self.store('bob')
        req = self.request(current, {'all': True}, 'POST')
        self.assertTrue(self.body(api.account_sessions_logout_api(req))['current_session_ended'])
        self.assertFalse(req.session.get('student_id'))
        self.assertEqual(list(Session.objects.values_list('session_key', flat=True)), [other.session_key])

    def test_current_device_logout_flushes_request(self):
        store = self.store()
        req = self.request(store, {'session_id': api._opaque_id(store.session_key)}, 'POST')
        self.assertTrue(self.body(api.account_sessions_logout_api(req))['current_session_ended'])
        self.assertIsNone(req.session.session_key)

    def test_missing_authentication_is_rejected(self):
        req = self.request()
        req.session.flush()
        self.assertEqual(api.account_sessions_api(req).status_code, 401)
        req.method = 'POST'
        self.assertEqual(api.account_sessions_logout_api(req).status_code, 401)

    def test_post_requires_csrf_cookie_and_matching_header(self):
        store = self.store()
        client = Client(enforce_csrf_checks=True)
        client.cookies[settings.SESSION_COOKIE_NAME] = store.session_key
        client.get('/sessions/', secure=True)
        self.assertEqual(client.post('/logout/', {'all': True}, content_type='application/json').status_code, 403)
        token = client.cookies[settings.CSRF_COOKIE_NAME].value
        self.assertEqual(client.post('/logout/', {'all': True}, content_type='application/json', HTTP_X_CSRFTOKEN=token, secure=True, HTTP_REFERER='https://testserver/').status_code, 200)

    def middleware(self, req, current_hash='hash'):
        cursor = MagicMock()
        cursor.__enter__.return_value = cursor
        cursor.fetchone.return_value = (current_hash,)
        with patch.object(api, 'connection', SimpleNamespace(cursor=lambda: cursor)):
            return api.AccountSessionMiddleware(lambda request: HttpResponse('ok'))(req)

    def test_password_stamp_change_revokes_session_on_next_request(self):
        store = self.store(_elecom_auth_stamp=api.password_stamp('old-hash'))
        req = self.request(store)
        self.assertEqual(self.middleware(req, 'new-hash').status_code, 401)
        self.assertFalse(req.session.get('student_id'))

    def test_legacy_session_gets_stamp_and_device_metadata(self):
        req = self.request()
        self.assertEqual(self.middleware(req).status_code, 200)
        details = req.session[api._DEVICE]
        self.assertIn('itel A667LP', details['device_name'])
        self.assertIsNone(details['signed_in_at'])
        self.assertEqual(details['ip_address'], '203.0.113.9')
        self.assertEqual(req.session[api._STAMP], api.password_stamp('hash'))

    def test_login_rotates_session_and_removes_old_account_privileges(self):
        old = self.store('bob', developer_access_verified_at='old-privilege')
        key = old.session_key
        req = self.request(old)
        api.start_account_session(req, 'alice', 'student', 'new-hash')
        req.session.save()
        self.assertNotEqual(key, req.session.session_key)
        self.assertNotIn('developer_access_verified_at', req.session)
        self.assertEqual(req.session['student_id'], 'alice')
        self.assertIsNotNone(req.session[api._DEVICE]['signed_in_at'])

    def test_untrusted_remote_cannot_spoof_forwarded_address(self):
        req = self.request()
        req.META['HTTP_X_REAL_IP'] = '198.51.100.1'
        self.assertEqual(api._ip(req), '203.0.113.9')
        req.META['REMOTE_ADDR'] = '127.0.0.1'
        self.assertEqual(api._ip(req), '198.51.100.1')

    def test_logout_all_unlinks_only_the_accounts_push_tokens(self):
        with connection.cursor() as cur:
            cur.execute("INSERT INTO mobile_push_tokens VALUES ('alice-token', 'alice'), ('bob-token', 'bob')")
        api.revoke_account_sessions('alice')
        with connection.cursor() as cur:
            cur.execute('SELECT student_id FROM mobile_push_tokens')
            self.assertEqual(cur.fetchall(), [('bob',)])

    def test_one_device_logout_unlinks_its_push_token(self):
        target = self.store(_elecom_push_token='device-token')
        with connection.cursor() as cur:
            cur.execute("INSERT INTO mobile_push_tokens VALUES ('device-token', 'alice')")
        api.account_sessions_logout_api(self.request(data={'session_id': api._opaque_id(target.session_key)}, method='POST'))
        with connection.cursor() as cur:
            cur.execute('SELECT COUNT(*) FROM mobile_push_tokens')
            self.assertEqual(cur.fetchone()[0], 0)

    def test_logging_out_an_older_session_keeps_reused_installation_token(self):
        target = self.store(_elecom_push_token='shared-device-token')
        current = self.store(_elecom_push_token='shared-device-token')
        with connection.cursor() as cur:
            cur.execute("INSERT INTO mobile_push_tokens VALUES ('shared-device-token', 'alice')")
        api.account_sessions_logout_api(self.request(current, {'session_id': api._opaque_id(target.session_key)}, 'POST'))
        with connection.cursor() as cur:
            cur.execute('SELECT COUNT(*) FROM mobile_push_tokens')
            self.assertEqual(cur.fetchone()[0], 1)

    def test_malformed_logout_requests_do_not_revoke(self):
        for payload in ([], {'all': 'true'}, {}, {'all': True, 'session_id': 'conflict'}):
            response = api.account_sessions_logout_api(self.request(data=payload, method='POST'))
            self.assertEqual(response.status_code, 400)


class PasswordRevocationTests(unittest.TestCase):
    def setUp(self):
        tree = ast.parse(Path(__file__).with_name('views.py').read_text(encoding='utf-8'))
        nodes = [node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name in {
            'account_profile_password_api', 'forgot_password_reset_password_api'}]
        for node in nodes:
            node.decorator_list = []
        cursor = MagicMock()
        cursor.__enter__.return_value = cursor
        cursor.fetchone.return_value = ('old-hash',)
        self.revoke = Mock()
        self.verify = Mock(return_value=True)
        self.ns = dict(json=json, connection=SimpleNamespace(cursor=lambda: cursor),
            transaction=SimpleNamespace(atomic=nullcontext), _ensure_auth_identity_tables=Mock(),
            _verify_password=self.verify, revoke_account_sessions=self.revoke,
            _consume_reset_token=Mock(return_value='alice'), _insert_user_notification_for_student=Mock(),
            logger=Mock(), settings=SimpleNamespace(DEBUG=False),
            JsonResponse=lambda data, status=200: SimpleNamespace(data=data, status_code=status))
        exec(compile(ast.Module(body=nodes, type_ignores=[]), '<password security>', 'exec'), self.ns)
        self.req = SimpleNamespace(session={'student_id': 'alice'}, body=json.dumps({
            'old_password': 'old-pass', 'new_password': 'new-password', 'confirm_password': 'new-password',
            'reset_token': 'test-reset-token'}).encode())
        fake_bcrypt = SimpleNamespace(hashpw=lambda *args: b'new-hash', gensalt=lambda: b'salt')
        self.patcher = patch.dict(sys.modules, bcrypt=fake_bcrypt)
        self.patcher.start()
        self.addCleanup(self.patcher.stop)

    def test_password_change_revokes_every_session(self):
        self.assertTrue(self.ns['account_profile_password_api'](self.req).data['session_ended'])
        self.revoke.assert_called_once_with('alice', self.req)

    def test_wrong_password_never_revokes(self):
        self.verify.return_value = False
        self.assertEqual(self.ns['account_profile_password_api'](self.req).status_code, 400)
        self.revoke.assert_not_called()

    def test_password_reset_revokes_every_session(self):
        self.assertTrue(self.ns['forgot_password_reset_password_api'](self.req).data['session_ended'])
        self.revoke.assert_called_once_with('alice', self.req)


if __name__ == '__main__':
    unittest.main()
