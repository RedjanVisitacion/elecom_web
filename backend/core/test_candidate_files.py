"""Check document access and election scoping without biometric dependencies."""
import ast
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import Mock


class CandidateFilesTests(unittest.TestCase):
    def setUp(self):
        module = ast.parse(Path(__file__).with_name('views.py').read_text(encoding='utf-8-sig'))
        function = next(node for node in module.body if isinstance(node, ast.FunctionDef)
                        and node.name == 'admin_candidates_files_api')
        function.decorator_list = []
        self.cursor = Mock()
        self.cursor.description = [('id',), ('student_id',), ('requirements_photo_url',)]
        self.cursor.fetchall.side_effect = [[(1, 'student', 'photo')], [(2, 'manual', None)]]
        context = Mock()
        context.__enter__ = Mock(return_value=self.cursor)
        context.__exit__ = Mock(return_value=False)
        self.namespace = {
            '_require_admin': Mock(return_value=None),
            '_current_election_id': lambda: 9,
            '_ensure_candidate_applications_table': Mock(),
            '_ensure_election_scoped_tables': Mock(),
            'connection': SimpleNamespace(cursor=lambda: context),
            'logger': Mock(),
            'JsonResponse': lambda data, status=200: SimpleNamespace(data=data, status_code=status),
        }
        exec(compile(ast.Module(body=[function], type_ignores=[]), '<candidate files>', 'exec'), self.namespace)

    def call(self, query=None):
        return self.namespace['admin_candidates_files_api'](SimpleNamespace(GET=query or {}))

    def test_non_admin_cannot_read_files(self):
        denied = object()
        self.namespace['_require_admin'].return_value = denied
        self.assertIs(self.call(), denied)
        self.cursor.execute.assert_not_called()

    def test_current_and_historical_elections_include_manual_candidates(self):
        for query, expected in (({}, 9), ({'election_id': '4'}, 4)):
            self.setUp()
            result = self.call(query)
            self.assertTrue(result.data['ok'])
            self.assertEqual(len(result.data['candidates']), 2)
            self.assertEqual(result.data['election_id'], expected)
            for call in self.cursor.execute.call_args_list:
                self.assertEqual(call.args[1], [expected])
                self.assertIn('election_id', call.args[0])
                self.assertNotIn('LIMIT ', call.args[0])
            self.assertIn('NOT EXISTS', self.cursor.execute.call_args_list[1].args[0])

    def test_invalid_scope_is_rejected(self):
        for value in ('bad', '0', '-3'):
            self.assertEqual(self.call({'election_id': value}).status_code, 400)
        self.cursor.execute.assert_not_called()

    def test_database_failure_returns_json_error(self):
        self.cursor.execute.side_effect = RuntimeError('private database details')
        result = self.call()
        self.assertEqual(result.status_code, 500)
        self.assertFalse(result.data['ok'])
        self.assertNotIn('private', result.data['error'])


if __name__ == '__main__':
    unittest.main()
