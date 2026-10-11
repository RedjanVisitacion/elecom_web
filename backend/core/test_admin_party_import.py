"""Admin imports can reuse a party without its student-facing security code."""
import ast
import json
from contextlib import nullcontext
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import Mock


class AdminPartyImportTests(unittest.TestCase):
    def setup_endpoint(self, forbidden=None):
        tree = ast.parse(Path(__file__).with_name('views.py').read_text(encoding='utf-8-sig'))
        function = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == 'admin_candidates_create_api')
        function.decorator_list = []
        cursor = Mock()
        cursor.fetchone.side_effect = [None, (42,)]
        env = dict(json=json, normalize_middle_name=lambda v: v,
                   _require_admin=Mock(return_value=forbidden),
                   _post_bool=lambda p, key, default: p.get(key, default),
                   _ensure_election_scoped_tables=Mock(), _ensure_candidate_applications_table=Mock(),
                   _active_election_id=lambda: 1,
                   transaction=SimpleNamespace(atomic=nullcontext),
                   connection=SimpleNamespace(cursor=lambda: nullcontext(cursor)),
                   party_key=lambda name: str(name or '').lower(), lock_party=Mock(),
                   party_rows=Mock(return_value=[('UNITE', 'stored-hash', 'stored-code', 'shared-logo')]),
                   _sync_party_security_code=Mock(return_value=('stored-code', 'stored-hash')),
                   canonical_logo=Mock(return_value='shared-logo'), share_logo=Mock(),
                   JsonResponse=lambda data, status=200: SimpleNamespace(data=data, status_code=status))
        exec(compile(ast.Module(body=[function], type_ignores=[]), '<admin import>', 'exec'), env)
        return env, cursor

    def test_admin_import_without_code_reuses_party_and_logo(self):
        env, cursor = self.setup_endpoint()
        payload = dict(student_id='test-student', first_name='Test', last_name='Candidate',
                       organization='USG', position='President', program='BSIT',
                       year_section='BSIT-1A', platform='Test platform', party_name='unite',
                       party_logo_url='different-logo', allow_existing=True)
        request = SimpleNamespace(content_type='application/json', body=json.dumps(payload).encode())
        response = env['admin_candidates_create_api'](request)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, {'ok': True, 'id': 42})
        params = cursor.execute.call_args.args[1]
        self.assertEqual(params[10], 'UNITE')
        self.assertEqual(params[12], 'shared-logo')
        self.assertEqual(params[14:], ['stored-hash', 'stored-code'])
        env['share_logo'].assert_called_once_with(cursor, 1, 'UNITE', 'shared-logo')

    def test_non_admin_is_rejected_before_import(self):
        forbidden = SimpleNamespace(status_code=403)
        env, cursor = self.setup_endpoint(forbidden)
        self.assertIs(env['admin_candidates_create_api'](SimpleNamespace()), forbidden)
        cursor.execute.assert_not_called()


if __name__ == '__main__':
    unittest.main()
