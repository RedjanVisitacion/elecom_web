"""Test the Django policy without importing unrelated face-service dependencies."""
import ast
from pathlib import Path
import unittest
from types import SimpleNamespace
from core.names import identity_row, normalize_middle_name

source = Path(__file__).with_name('views.py').read_text(encoding='utf-8-sig')
module = ast.parse(source)
names = {'_candidate_application_can_file_again', '_candidate_application_json',
         'candidate_application_submit_api'}
functions = [node for node in module.body if isinstance(node, ast.FunctionDef) and node.name in names]
for function in functions:
    function.decorator_list = []
namespace = {'identity_row': identity_row, 'normalize_middle_name': normalize_middle_name}
exec(compile(ast.Module(body=functions, type_ignores=[]), '<candidate policy>', 'exec'), namespace)
can_file_again = namespace['_candidate_application_can_file_again']
serialize = namespace['_candidate_application_json']


class CandidateRefilingPolicyTests(unittest.TestCase):
    def test_initial_rejection_allows_refiling(self):
        self.assertTrue(can_file_again({'status': 'rejected'}))
        self.assertTrue(serialize({'status': 'rejected'})['can_file_again'])

    def test_follow_up_rejection_blocks_refiling(self):
        for field in ('requirements_submitted_at', 'requirements_photo_url',
                      'enrollment_certificate_url', 'grades_url', 'good_moral_url'):
            with self.subTest(field=field):
                application = {'status': 'rejected', field: 'saved'}
                self.assertFalse(can_file_again(application))
                self.assertFalse(serialize(application)['can_file_again'])

    def test_other_statuses_cannot_refile(self):
        for status in ('pending', 'requirements_pending', 'requirements_review', 'approved'):
            self.assertFalse(can_file_again({'status': status}))

    def test_submit_api_blocks_follow_up_rejection_before_uploading(self):
        class Cursor:
            description = [(field,) for field in (
                'id', 'election_id', 'student_id', 'position', 'status',
                'requirements_submitted_at', 'requirements_photo_url',
                'enrollment_certificate_url', 'grades_url', 'good_moral_url',
            )]

            def __enter__(self):
                return self

            def __exit__(self, *args):
                pass

            def execute(self, sql, params):
                # The guard must fetch the rejection-stage metadata.
                assert 'requirements_submitted_at' in sql
                assert params == [1, 'student']

            def fetchone(self):
                return (1, 1, 'student', 'President', 'rejected',
                        '2026-10-06', 'photo', 'enrollment', 'grades', 'moral')

        namespace.update(
            connection=SimpleNamespace(cursor=Cursor),
            _current_election_id=lambda: 1,
            _ensure_election_scoped_tables=lambda: None,
            _ensure_candidate_applications_table=lambda: None,
            read_certificate_upload=lambda request: None,
            ensure_certificate_table=lambda: None,
            JsonResponse=lambda data, status=200: SimpleNamespace(data=data, status_code=status),
            settings=SimpleNamespace(DEBUG=True),
        )
        for position in ('President', 'Vice President'):
            request = SimpleNamespace(
                session={'student_id': 'student'},
                POST={'first_name': 'First', 'last_name': 'Last',
                      'organization': 'USG', 'position': position, 'program': 'BSIT',
                      'year_section': 'BSIT-4A', 'platform': 'Platform'},
                FILES={'candidate_photo': object()},
            )
            response = namespace['candidate_application_submit_api'](request)
            self.assertEqual(response.status_code, 409)
            self.assertEqual(response.data['code'], 'requirements_rejected')


if __name__ == '__main__':
    unittest.main()
