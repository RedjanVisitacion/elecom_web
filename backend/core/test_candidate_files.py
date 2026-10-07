"""Check document access and election scoping without biometric dependencies."""
import ast
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import Mock
from core.names import identity_row


class CandidateFilesTests(unittest.TestCase):
    def setUp(self):
        module = ast.parse(Path(__file__).with_name('views.py').read_text(encoding='utf-8-sig'))
        function = next(node for node in module.body if isinstance(node, ast.FunctionDef)
                        and node.name == 'admin_candidates_files_api')
        function.decorator_list = []
        self.cursor = Mock()
        self.cursor.description = [('id',), ('student_id',), ('requirements_photo_url',)]
        self.cursor.fetchall.side_effect = [[(1, 'student', 'photo')], [(2, 'manual', None)], []]
        context = Mock()
        context.__enter__ = Mock(return_value=self.cursor)
        context.__exit__ = Mock(return_value=False)
        self.namespace = {
            'identity_row': identity_row,
            '_require_admin': Mock(return_value=None),
            '_current_election_id': lambda: 9,
            '_ensure_candidate_applications_table': Mock(),
            '_ensure_election_scoped_tables': Mock(),
            '_ensure_admin_candidate_documents_table': Mock(),
            'get_token': lambda request: 'csrf',
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
            for call in self.cursor.execute.call_args_list[:2]:
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


class CandidateDocumentTests(unittest.TestCase):
    def setUp(self):
        from contextlib import nullcontext
        module = ast.parse(Path(__file__).with_name('views.py').read_text(encoding='utf-8-sig'))
        functions = [node for node in module.body if isinstance(node, ast.FunctionDef)
                     and node.name in {'admin_candidate_document_api', '_uploaded_candidate_pdf'}]
        for function in functions:
            function.decorator_list = []
        self.cursor = Mock()
        self.cursor.fetchone.return_value = (7,)
        self.ns = {
            '_require_admin': Mock(return_value=None),
            '_ensure_candidate_applications_table': Mock(),
            '_ensure_election_scoped_tables': Mock(),
            '_ensure_admin_candidate_documents_table': Mock(),
            'connection': SimpleNamespace(cursor=lambda: nullcontext(self.cursor)),
            'transaction': SimpleNamespace(atomic=nullcontext),
            'secrets': SimpleNamespace(token_hex=lambda count: 'unique'),
            'logger': Mock(),
            'upload_raw_bytes': Mock(return_value=('https://files/new.pdf', 'new-id')),
            'JsonResponse': lambda data, status=200: SimpleNamespace(data=data, status_code=status),
        }
        exec(compile(ast.Module(body=functions, type_ignores=[]), '<candidate documents>', 'exec'), self.ns)

    def call(self, source='registration', action='delete', kind='grades', files=None):
        return self.ns['admin_candidate_document_api'](SimpleNamespace(
            POST={'id': '7', 'election_id': '4', 'source': source, 'action': action, 'kind': kind},
            FILES=files or {}, session={'student_id': 'admin'}))

    def test_denied_admin_cannot_mutate(self):
        denied = object()
        self.ns['_require_admin'].return_value = denied
        self.assertIs(self.call(), denied)
        self.cursor.execute.assert_not_called()

    def test_missing_candidate_is_not_modified(self):
        self.cursor.fetchone.return_value = None
        self.assertEqual(self.call().status_code, 404)
        self.assertEqual(self.cursor.execute.call_count, 1)
        self.assertEqual(self.cursor.execute.call_args.args[1], [7, 4])

    def test_manual_delete_saves_null_override(self):
        self.assertTrue(self.call().data['ok'])
        sql, params = self.cursor.execute.call_args.args
        self.assertIn('ON CONFLICT', sql)
        self.assertEqual(params, [7, 'grades', None, None, 'admin'])

    def test_application_delete_preserves_final_decisions(self):
        self.assertTrue(self.call(source='application').data['ok'])
        self.assertEqual(self.cursor.execute.call_args_list[1].args[1], [None, None, 7])
        self.assertIn("status IN ('requirements_pending', 'requirements_review')", self.cursor.execute.call_args.args[0])

    def test_pdf_upload_persists_file(self):
        upload = SimpleNamespace(name='grade.pdf', content_type='application/pdf', read=lambda: b'%PDF-1.7 valid')
        self.assertTrue(self.call(action='upload', files={'grades': upload}).data['ok'])
        self.assertEqual(self.cursor.execute.call_args.args[1], [7, 'grades', 'https://files/new.pdf', 'new-id', 'admin'])

    def test_invalid_pdf_or_missing_upload_is_rejected(self):
        self.assertEqual(self.call(action='upload').status_code, 400)
        self.cursor.execute.assert_not_called()
        for raw in (b'not a pdf', b'', b'%PDF-' + b'x' * (8 * 1024 * 1024)):
            upload = SimpleNamespace(name='grade.pdf', content_type='application/pdf', read=lambda: raw)
            self.assertEqual(self.call(action='upload', files={'grades': upload}).status_code, 400)
        self.ns['upload_raw_bytes'].assert_not_called()

    def test_unknown_field_is_rejected(self):
        self.assertEqual(self.call(kind='status').status_code, 400)
        self.cursor.execute.assert_not_called()


if __name__ == '__main__':
    unittest.main()
