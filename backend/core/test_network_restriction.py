import ast
from contextlib import nullcontext
import ipaddress
import json
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import patch

tree = ast.parse(Path(__file__).with_name('views.py').read_text(encoding='utf-8'))
node = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == 'admin_network_settings_api')
node.decorator_list = []
ns = {'__name__': 'core.views', 'json': json, 'ipaddress': ipaddress}
exec(compile(ast.Module(body=[node], type_ignores=[]), '<network settings>', 'exec'), ns)


class Cursor:
    def __init__(self, rows=()): self.rows = iter(rows); self.queries = []
    def __enter__(self): return self
    def __exit__(self, *args): pass
    def execute(self, sql, params=None): self.queries.append((sql, params))
    def fetchone(self): return next(self.rows)


class RestrictionTests(unittest.TestCase):
    def setUp(self):
        self.cursor = Cursor()
        self.denied = None
        module = SimpleNamespace(_developer_admin=lambda request: self.denied)
        patcher = patch.dict('sys.modules', {'core.developer_options': module})
        patcher.start(); self.addCleanup(patcher.stop)
        ns.update(_require_admin=lambda r: None,
                  _ensure_network_authorization_tables=lambda c: None,
                  connection=SimpleNamespace(cursor=lambda: self.cursor),
                  transaction=SimpleNamespace(atomic=nullcontext),
                  JsonResponse=lambda data, status=200: SimpleNamespace(data=data, status_code=status))

    def call(self, payload):
        return ns['admin_network_settings_api'](SimpleNamespace(method='POST', body=json.dumps(payload).encode()))

    def test_only_developer_verified_session_can_toggle(self):
        self.denied = SimpleNamespace(status_code=403)
        self.assertEqual(self.call({'action': 'set_enabled', 'enabled': True}).status_code, 403)
        self.assertEqual(self.cursor.queries, [])

    def test_developer_toggle_updates_all_rows(self):
        self.cursor = Cursor([(2,)])
        result = self.call({'action': 'set_enabled', 'enabled': True})
        self.assertTrue(result.data['enabled'])
        self.assertEqual(self.cursor.queries[-1][1], ['Active'])
        self.assertIn('LOCK TABLE', self.cursor.queries[0][0])

    def test_enable_requires_at_least_one_network(self):
        self.cursor = Cursor([(0,)])
        self.assertEqual(self.call({'action': 'set_enabled', 'enabled': True}).status_code, 400)
        self.assertFalse(any('UPDATE' in q[0] for q in self.cursor.queries))

    def test_invalid_toggle_value_is_rejected(self):
        self.assertEqual(self.call({'action': 'set_enabled', 'enabled': 'true'}).status_code, 400)
        self.assertEqual(self.cursor.queries, [])

    def test_add_cannot_enable_disabled_restriction_even_with_old_client_payload(self):
        self.cursor = Cursor([(False,), (7,)])
        result = self.call({'network_ip': '192.168.0.1', 'ssid': 'Campus', 'enabled': True, 'status': 'Active'})
        self.assertFalse(result.data['enabled'])
        self.assertEqual(self.cursor.queries[-1][1][-1], 'Disabled')

    def test_add_preserves_enabled_restriction_despite_client_payload(self):
        self.cursor = Cursor([(True,), (7,)])
        result = self.call({'network_ip': '192.168.0.1', 'enabled': False, 'status': 'Disabled'})
        self.assertTrue(result.data['enabled'])
        self.assertEqual(self.cursor.queries[-1][1][-1], 'Active')


if __name__ == '__main__': unittest.main()
