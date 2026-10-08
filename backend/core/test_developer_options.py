import json
import os
from contextlib import nullcontext
from datetime import timedelta
from types import SimpleNamespace
import unittest
from unittest.mock import Mock, patch

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
from django.utils import timezone
from core import developer_options as api


class DeveloperUsersTests(unittest.TestCase):
    def setUp(self):
        self.cursor = Mock()
        self.cursor.fetchone.return_value = (1,)
        self.connection = patch.object(api, 'connection', SimpleNamespace(cursor=lambda: nullcontext(self.cursor)))
        self.connection.start()
        self.addCleanup(self.connection.stop)
        self.request = SimpleNamespace(method='GET', GET={}, session={'role': 'admin', 'student_id': 'admin',
            'developer_access_verified_at': timezone.now().isoformat()}, META={})

    def result(self):
        response = api.developer_users_api(self.request)
        return response.status_code, json.loads(response.content)

    def test_expired_password_verification_is_denied(self):
        self.request.session['developer_access_verified_at'] = (timezone.now() - timedelta(minutes=16)).isoformat()
        with patch.dict('sys.modules', {'core.views': SimpleNamespace(_require_admin=lambda request: None)}):
            self.assertEqual(self.result()[0], 403)
        self.cursor.execute.assert_not_called()

    def test_database_role_is_checked_even_with_admin_session(self):
        self.cursor.fetchone.return_value = None
        with patch.dict('sys.modules', {'core.views': SimpleNamespace(_require_admin=lambda request: None)}):
            self.assertEqual(self.result()[0], 403)

    def test_list_includes_admins_without_password_hashes_and_paginates(self):
        self.cursor.fetchall.return_value = [(i, str(i), 'Name', '', 'Last', 'mail', 'admin') for i in range(101)]
        self.request.GET = {'page': '2', 'q': 'name'}
        with patch.object(api, '_developer_admin', return_value=None):
            code, data = self.result()
        self.assertEqual(code, 200)
        self.assertTrue(data['has_more'])
        self.assertEqual(len(data['users']), 100)
        self.assertEqual(data['users'][0]['role'], 'admin')
        self.assertNotIn('password_hash', data['users'][0])
        self.assertEqual(self.cursor.execute.call_args.args[1], ['%name%', 100])

    def test_promotion_updates_role_used_by_login(self):
        self.request.method = 'POST'
        self.request.body = b'{"id":7,"role":"admin"}'
        with patch.object(api, '_developer_admin', return_value=None), patch.object(api, 'transaction', SimpleNamespace(atomic=nullcontext)):
            self.assertEqual(self.result()[0], 200)
        self.assertEqual(self.cursor.execute.call_args.args, ("UPDATE users SET role = 'admin' WHERE id = %s", [7]))

    def test_unknown_account_is_not_updated(self):
        self.cursor.fetchone.return_value = None
        self.request.method = 'POST'
        self.request.body = b'{"id":7,"role":"admin"}'
        with patch.object(api, '_developer_admin', return_value=None), patch.object(api, 'transaction', SimpleNamespace(atomic=nullcontext)):
            self.assertEqual(self.result()[0], 404)
        self.assertEqual(self.cursor.execute.call_count, 1)

    def test_invalid_role_or_payload_cannot_change_accounts(self):
        self.request.method = 'POST'
        with patch.object(api, '_developer_admin', return_value=None):
            for payload in (b'[]', b'null', b'{"id":7,"role":"student"}', b'{"id":0,"role":"admin"}'):
                self.request.body = payload
                self.assertEqual(self.result()[0], 400)
        self.cursor.execute.assert_not_called()
