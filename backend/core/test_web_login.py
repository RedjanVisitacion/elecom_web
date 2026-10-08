"""Admin web login restrictions and released mobile-client compatibility."""
import ast
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import Mock, MagicMock


class WebLoginTests(unittest.TestCase):
    def setUp(self):
        tree = ast.parse(Path(__file__).with_name('views.py').read_text(encoding='utf-8-sig'))
        functions = [node for node in tree.body if isinstance(node, ast.FunctionDef)
                     and node.name in {'login_view', 'admin_login_api'}]
        for node in functions:
            node.decorator_list = []
        self.user = SimpleNamespace(id=7, student_id='123', password_hash='hash', role='student')
        self.verify = Mock(return_value=True)
        self.ns = {
            '_ensure_auth_identity_tables': Mock(), '_verify_password': self.verify,
            'ElecomUser': SimpleNamespace(objects=SimpleNamespace(filter=lambda **kwargs: SimpleNamespace(first=lambda: self.user))),
            'json': __import__('json'), 'connection': MagicMock(), 'logger': Mock(),
            'settings': SimpleNamespace(APP_UPDATE_APK_URL='https://example.com/elecom.apk'),
            'JsonResponse': lambda data, status=200: SimpleNamespace(data=data, status_code=status),
        }
        exec(compile(ast.Module(body=functions, type_ignores=[]), '<web login>', 'exec'), self.ns)
        self.request = SimpleNamespace(method='POST', content_type='application/json',
                                       body=b'{"studentId":"123","password":"password"}', session={}, headers={})

    def test_voter_cannot_create_web_session(self):
        result = self.ns['admin_login_api'](self.request)
        self.assertEqual(result.status_code, 403)
        self.assertEqual(result.data['code'], 'ADMIN_WEB_ONLY')
        self.assertIn('ELECOM app', result.data['error'])
        self.assertEqual(self.request.session, {})

    def test_promoted_admin_can_login_to_web(self):
        self.user.role = 'ADMIN'
        result = self.ns['admin_login_api'](self.request)
        self.assertTrue(result.data['ok'])
        self.assertEqual(self.request.session['role'], 'admin')

    def test_released_mobile_login_still_accepts_voter(self):
        result = self.ns['login_view'](self.request)
        self.assertTrue(result.data['ok'])
        self.assertEqual(self.request.session['role'], 'student')

    def test_browser_using_legacy_login_is_also_blocked(self):
        self.request.headers['Sec-Fetch-Site'] = 'same-origin'
        self.assertEqual(self.ns['login_view'](self.request).status_code, 403)
        self.assertEqual(self.request.session, {})

    def test_rejected_web_login_does_not_replace_an_existing_admin_session(self):
        self.request.session.update(student_id='admin', role='admin')
        self.ns['admin_login_api'](self.request)
        self.assertEqual(self.request.session, {'student_id': 'admin', 'role': 'admin'})

    def test_bad_password_stays_invalid_credentials(self):
        self.verify.return_value = False
        result = self.ns['admin_login_api'](self.request)
        self.assertEqual(result.status_code, 401)
        self.assertNotIn('apk_url', result.data)
