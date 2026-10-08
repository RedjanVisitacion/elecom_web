"""Follow-up submission requires three PDFs; the initial COC has the photo."""
import ast
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import MagicMock, Mock

module = ast.parse(Path(__file__).with_name('views.py').read_text(encoding='utf-8-sig'))
function = next(n for n in module.body if isinstance(n, ast.FunctionDef) and n.name == 'candidate_application_requirements_api')
function.decorator_list = []


class CandidateRequirementsTests(unittest.TestCase):
    def submit(self, files, existing=(None, None, None), stage='requirements_pending'):
        cursor = MagicMock()
        cursor.fetchone.return_value = (1, stage, None, *existing)
        connection = MagicMock()
        connection.cursor.return_value.__enter__.return_value = cursor
        namespace = dict(connection=connection, _ensure_candidate_applications_table=Mock(),
                         _current_election_id=lambda: 7,
                         _uploaded_candidate_pdf=lambda request, field, folder: (field + '-url', field + '-id'),
                         _insert_user_notification_for_student=Mock(), settings=SimpleNamespace(DEBUG=True),
                         JsonResponse=lambda data, status=200: SimpleNamespace(data=data, status_code=status))
        exec(compile(ast.Module(body=[function], type_ignores=[]), '<requirements>', 'exec'), namespace)
        result = namespace[function.name](SimpleNamespace(session={'student_id': 'student'}, FILES=files))
        return result, cursor

    def test_three_pdfs_complete_without_separate_photo(self):
        result, cursor = self.submit(dict.fromkeys(['enrollment_certificate', 'grades', 'good_moral'], object()))
        self.assertEqual(result.status_code, 200)
        self.assertEqual(result.data['status'], 'requirements_review')
        self.assertIn('requirements_submitted_at = CURRENT_TIMESTAMP', cursor.execute.call_args.args[0])

    def test_missing_pdf_stays_pending(self):
        result, cursor = self.submit({'grades': object()})
        self.assertEqual(result.data['status'], 'requirements_pending')
        self.assertNotIn("status = 'requirements_review'", cursor.execute.call_args.args[0])

    def test_saved_pdfs_count_toward_completion(self):
        result, _ = self.submit({'good_moral': object()}, ('enrollment-url', 'grades-url', None))
        self.assertEqual(result.data['status'], 'requirements_review')

    def test_initial_pending_cannot_upload_requirements(self):
        result, _ = self.submit({'grades': object()}, stage='pending')
        self.assertEqual(result.status_code, 403)


if __name__ == '__main__':
    unittest.main()
