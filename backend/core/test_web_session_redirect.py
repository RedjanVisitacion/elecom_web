"""Protected HTML routes redirect ended sessions; API/permission gates remain intact."""
import ast
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import Mock


class WebSessionRedirectTests(unittest.TestCase):
    def setUp(self):
        tree = ast.parse(Path(__file__).with_name('views.py').read_text(encoding='utf-8-sig'))
        functions = [node for node in tree.body if isinstance(node, ast.FunctionDef)
                     and node.name in {'admin_secure_page_view', '_serve_admin_static_page'}]
        for node in functions:
            node.decorator_list = []
        self.forbidden = object()
        self.gate = Mock(return_value=self.forbidden)
        self.ns = {'_require_admin': self.gate,
                   'HttpResponseRedirect': lambda url: {'Location': url}}
        exec(compile(ast.Module(body=functions, type_ignores=[]), '<protected pages>', 'exec'), self.ns)

    def test_ended_sessions_redirect_both_html_routes_without_caching(self):
        for name in ('admin_secure_page_view', '_serve_admin_static_page'):
            with self.subTest(route=name):
                response = self.ns[name](SimpleNamespace(session={}), 'route')
                self.assertEqual(response['Location'], '/login/?session_ended=1')
                self.assertEqual(response['Cache-Control'], 'no-store')
        self.gate.assert_not_called()

    def test_signed_in_nonadmins_keep_permission_denial(self):
        for name in ('admin_secure_page_view', '_serve_admin_static_page'):
            with self.subTest(route=name):
                response = self.ns[name](SimpleNamespace(session={'student_id': 'student'}), 'route')
                self.assertIs(response, self.forbidden)

    def test_authenticated_admin_continues_to_existing_page_validation(self):
        self.gate.side_effect = RuntimeError('existing admin validation')
        for name in ('admin_secure_page_view', '_serve_admin_static_page'):
            with self.assertRaisesRegex(RuntimeError, 'existing admin validation'):
                self.ns[name](SimpleNamespace(session={'student_id': 'admin'}), 'route')
