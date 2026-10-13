"""Isolated current-election Student ID guard regression tests."""
import ast
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock
import unittest

tree = ast.parse(Path(__file__).with_name('views.py').read_text(encoding='utf-8'))
names = {'_official_candidate_for_student', '_already_candidate_response',
         'candidate_application_status_api', 'candidate_application_submit_api', '_lock_candidate_student'}
nodes = [n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name in names]
for node in nodes: node.decorator_list = []
ns = {}
exec(compile(ast.Module(body=nodes, type_ignores=[]), '<student guard>', 'exec'), ns)


class Cursor:
    def __init__(self, rows): self.rows = iter(rows); self.queries = []
    def __enter__(self): return self
    def __exit__(self, *args): pass
    def execute(self, sql, params=None): self.queries.append((sql, params))
    def fetchone(self): return next(self.rows)


class StudentGuardTests(unittest.TestCase):
    def setUp(self):
        self.cursor = Cursor([])
        ns.update(connection=SimpleNamespace(cursor=lambda: self.cursor),
                  JsonResponse=lambda data, status=200: SimpleNamespace(data=data, status_code=status),
                  _ensure_candidate_applications_table=lambda: None,
                  _ensure_election_scoped_tables=lambda: None,
                  ensure_certificate_table=lambda: None,
                  _current_election_id=lambda: 12,
                  normalize_middle_name=lambda x: x or '',
                  read_certificate_upload=lambda r: {},
                  settings=SimpleNamespace(DEBUG=False))

    def test_query_matches_student_across_positions_and_current_election(self):
        self.cursor = Cursor([(9, 'USG', 'President')])
        result = ns['_official_candidate_for_student'](self.cursor, election_id=12, student_id=' 123 ')
        self.assertEqual(result, {'id': 9, 'organization': 'USG', 'position': 'President'})
        sql, params = self.cursor.queries[0]
        self.assertEqual(params, [12, 12, '123'])
        self.assertNotIn('AND position', sql)
        self.assertIn('COALESCE(election_id, %s, 0)', sql)

    def test_status_reports_manual_candidate_without_filing(self):
        self.cursor = Cursor([(9, 'USG', 'President'), None])
        result = ns['candidate_application_status_api'](SimpleNamespace(session={'student_id': '123'}))
        self.assertEqual(result.status_code, 200)
        self.assertIsNone(result.data['application'])
        self.assertEqual(result.data['official_candidate']['id'], 9)

    def test_no_current_registration_leaves_filing_available(self):
        self.cursor = Cursor([None, None])
        result = ns['candidate_application_status_api'](SimpleNamespace(session={'student_id': '123'}))
        self.assertIsNone(result.data['official_candidate'])

    def test_submit_different_position_rejected_before_upload(self):
        self.cursor = Cursor([(9, 'USG', 'President')])
        upload = Mock()
        ns['_uploaded_candidate_image'] = upload
        request = SimpleNamespace(session={'student_id': '123'}, FILES={'candidate_photo': object()}, POST={
            'student_id': '123', 'first_name': 'Test', 'last_name': 'Student',
            'organization': 'SITE', 'position': 'Treasurer', 'program': 'BSIT',
            'year_section': 'BSIT-4A', 'platform': 'Platform', 'candidate_type': 'Independent',
        })
        result = ns['candidate_application_submit_api'](request)
        self.assertEqual(result.status_code, 409)
        self.assertEqual(result.data['code'], 'already_candidate')
        upload.assert_not_called()

    def test_identity_is_taken_from_authenticated_session(self):
        result = ns['candidate_application_submit_api'](SimpleNamespace(
            session={'student_id': '123'}, POST={'student_id': '456'}))
        self.assertEqual(result.status_code, 403)
        self.assertEqual(self.cursor.queries, [])

    def test_all_registration_writes_lock_then_check_student(self):
        for name in ('candidate_application_submit_api', 'admin_candidates_create_api',
                     'admin_candidate_application_decision_api'):
            node = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == name)
            code = ast.unparse(node)
            lock = code.index('_lock_candidate_student')
            guard = code.index('_official_candidate_for_student', lock)
            write = code.index('INSERT INTO candidate', guard)
            self.assertLess(lock, guard)
            self.assertLess(guard, write)


if __name__ == '__main__': unittest.main()
