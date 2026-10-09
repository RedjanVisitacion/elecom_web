"""Settings validation, local approval date, archive preservation and authorization."""
import ast
import io
import json
import os
from contextlib import nullcontext
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import Mock, patch

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
from core import coc_management as coc
from pypdf import PdfReader

CONFIG = {'academic_year_start': 2025, 'academic_year_end': 2026,
          'academic_year': '2025 - 2026', 'chairperson_name': 'Maria PeÃ±a'}
APPROVED = datetime(2026, 10, 8, 16, 5, tzinfo=timezone.utc)
FORMS = Path(__file__).with_name('forms')


class CocManagementTests(unittest.TestCase):
    def test_settings_validate_and_normalize(self):
        self.assertEqual(coc.validate_settings({'form_kind': 'usg', **CONFIG}), ('usg', 2025, 2026, 'Maria PeÃ±a'))
        for changes in ({'form_kind': 'unknown'}, {'academic_year_end': 2028}, {'chairperson_name': ''}, {'chairperson_name': 'x' * 121}):
            with self.subTest(changes=changes), self.assertRaises(ValueError):
                coc.validate_settings({'form_kind': 'usg', **CONFIG, **changes})

    def test_organization_selects_correct_form(self):
        for organization in ['SITE', ' PAFE ', 'AFPROTECHS', 'afpro']:
            self.assertEqual(coc.form_kind(organization), 'department')
        self.assertEqual(coc.form_kind('USG'), 'usg')

    def test_both_pdf_layouts_fill_year_chair_and_manila_approval_date(self):
        for filename in ['certificate_of_candidacy.pdf', 'department_certificate_of_candidacy.pdf']:
            with self.subTest(filename=filename):
                original = (FORMS / filename).read_bytes()
                issued = coc.decorate_pdf(original, CONFIG, APPROVED)
                text = PdfReader(io.BytesIO(issued)).pages[0].extract_text()
                self.assertIn('Academic Year 2025 - 2026', text)
                self.assertIn('Maria PeÃ±a', text)
                self.assertIn('this 9 day of October year 2026, at USTP Oroquieta Campus', text)
                self.assertEqual(original, (FORMS / filename).read_bytes())
                self.assertEqual(PdfReader(io.BytesIO(original)).pages[0].mediabox, PdfReader(io.BytesIO(issued)).pages[0].mediabox)

    def test_department_year_and_comma_are_one_inline_run(self):
        from pypdf.generic import ContentStream
        from reportlab.pdfbase.pdfmetrics import stringWidth

        original = (FORMS / 'department_certificate_of_candidacy.pdf').read_bytes()
        for year in ('2026 - 2027', '1900 - 1901', '2199 - 2200', '____ - ____'):
            with self.subTest(year=year):
                pdf = coc.decorate_pdf(original, {**CONFIG, 'academic_year': year})
                page = PdfReader(io.BytesIO(pdf)).pages[0]
                runs = []
                page.extract_text(visitor_text=lambda value, cm, tm, font, size:
                                  runs.append((value, tm, size)))
                expected = f'Academic Year {year}, and I do hereby declare my intention and desire to be'
                matching = [(value, tm, size) for value, tm, size in runs
                            if value.strip() == expected]
                self.assertEqual(len(matching), 1)
                _, tm, size = matching[0]
                self.assertAlmostEqual(tm[4], 185.66)
                self.assertAlmostEqual(tm[5], 202.82)
                self.assertLessEqual(tm[4] + stringWidth(expected, 'Times-Roman', size), 576.01)
                # The underline ends at the final year digit, before the comma.
                operations = ContentStream(page.get_contents(), page.pdf).operations
                move = next(args for args, op in reversed(operations) if op == b'm')
                line = next(args for args, op in reversed(operations) if op == b'l')
                start = 185.66 + stringWidth('Academic Year ', 'Times-Roman', size)
                self.assertAlmostEqual(float(move[0]), start, places=4)
                self.assertAlmostEqual(float(line[0]), start + stringWidth(year, 'Times-Roman', size), places=4)
        self.assertEqual(original, (FORMS / 'department_certificate_of_candidacy.pdf').read_bytes())

    def test_pending_preview_does_not_invent_approval_date(self):
        pdf = coc.decorate_pdf((FORMS / 'certificate_of_candidacy.pdf').read_bytes(), CONFIG)
        text = PdfReader(io.BytesIO(pdf)).pages[0].extract_text()
        self.assertIn('Academic Year 2025 - 2026', text)
        self.assertNotIn('day of October year 2026', text)
        self.assertIn('at USTP Oroquieta Campus', text)

    def test_approval_saves_separate_immutable_pdf_and_settings_snapshot(self):
        cur = Mock()
        original = (FORMS / 'certificate_of_candidacy.pdf').read_bytes()
        cur.fetchone.side_effect = [None, (original,), (2025, 2026, 'Maria PeÃ±a')]
        coc.issue_certificate(cur, {'id': 7, 'election_id': 3, 'organization': 'USG'}, APPROVED)
        self.assertEqual(cur.execute.call_args_list[2].args[1], [3])
        sql, values = cur.execute.call_args.args
        self.assertIn('candidate_certificate_issuances', sql)
        self.assertIn('ON CONFLICT (application_id) DO NOTHING', sql)
        self.assertNotEqual(values[1], original)
        self.assertEqual(json.loads(values[3]), CONFIG)
        self.assertEqual(values[4], APPROVED)

    def test_previously_issued_coc_is_not_changed(self):
        cur = Mock(); cur.fetchone.return_value = (7,)
        coc.issue_certificate(cur, {'id': 7}, APPROVED)
        self.assertEqual(cur.execute.call_count, 1)

    def test_missing_settings_block_issuance_without_mutating_application(self):
        cur = Mock(); cur.fetchone.side_effect = [None, (b'pdf',), None]
        with self.assertRaisesRegex(ValueError, 'Save the academic year'):
            coc.issue_certificate(cur, {'id': 7, 'organization': 'USG'}, APPROVED)
        self.assertFalse(any('INSERT' in call.args[0] or 'UPDATE' in call.args[0] for call in cur.execute.call_args_list))

    def test_legacy_filing_without_pdf_stays_reviewable(self):
        cur = Mock(); cur.fetchone.side_effect = [None, None]
        coc.issue_certificate(cur, {'id': 7}, APPROVED)
        self.assertEqual(cur.execute.call_count, 2)

    def test_saved_usg_settings_are_shared_when_loading_department(self):
        cur = Mock(); cur.fetchone.return_value = (2025, 2026, CONFIG['chairperson_name'])
        self.assertEqual(coc.read_settings(cur, 3, 'department'), CONFIG)
        sql, values = cur.execute.call_args.args
        self.assertEqual(values, [3])
        self.assertIn("WHEN form_kind = 'usg' THEN 0", sql)

    def test_student_cannot_update_settings(self):
        request = SimpleNamespace(method='POST', session={'role': 'student', 'student_id': 'student'})
        with patch.object(coc, 'connection') as connection:
            self.assertEqual(coc.settings_response(request, 3).status_code, 403)
            connection.cursor.assert_not_called()

    def test_settings_save_updates_both_forms_atomically_in_the_same_election(self):
        cur = Mock(); cur.fetchone.side_effect = [(2025, 2026, 'Maria PeÃ±a'), None]
        request = SimpleNamespace(method='POST', session={'role': 'admin', 'student_id': 'admin'},
                                  body=json.dumps({'form_kind': 'usg', **CONFIG}).encode())
        with patch.object(coc, 'connection', SimpleNamespace(cursor=lambda: nullcontext(cur))), patch.object(coc, 'get_token', return_value='csrf'):
            result = coc.settings_response(request, 3)
        self.assertEqual(result.status_code, 200)
        values = cur.execute.call_args_list[0].args[1]
        self.assertEqual(values, [3, 'usg', 2025, 2026, CONFIG['chairperson_name'], 'admin', None,
                                  3, 'department', 2025, 2026, CONFIG['chairperson_name'], 'admin', None, False])
        data = json.loads(result.content)
        self.assertEqual(data['forms']['usg'], data['forms']['department'])

    def test_draft_preview_uses_unsaved_values_without_database_access(self):
        request = SimpleNamespace(GET={'draft': '1', 'academic_year_start': '2027',
                                      'academic_year_end': '2028', 'chairperson_name': 'Draft Chair'})
        with patch.object(coc, 'connection') as connection:
            response = coc.template_response(request, 3, 'usg')
            connection.cursor.assert_not_called()
        self.assertEqual(response.status_code, 200)
        text = PdfReader(io.BytesIO(response.content)).pages[0].extract_text()
        self.assertIn('Academic Year 2027 - 2028', text)
        self.assertIn('Draft Chair', text)
        self.assertNotIn('day of October year 2026', text)

    def test_blank_draft_previews_both_templates_before_settings_are_saved(self):
        for kind in ('usg', 'department'):
            with self.subTest(kind=kind), patch.object(coc, 'connection') as connection:
                response = coc.template_response(SimpleNamespace(GET={'draft': '1'}), 3, kind)
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response['Content-Type'], 'application/pdf')
                connection.cursor.assert_not_called()

    def test_invalid_draft_year_and_overlong_chair_are_rejected(self):
        for fields in ({'academic_year_start': '2027', 'academic_year_end': '2029'},
                       {'chairperson_name': 'x' * 121}):
            with self.subTest(fields=fields), patch.object(coc, 'connection') as connection:
                response = coc.template_response(SimpleNamespace(GET={'draft': '1', **fields}), 3, 'usg')
                self.assertEqual(response.status_code, 400)
                connection.cursor.assert_not_called()

    def test_admin_settings_and_template_routes_reject_non_admin(self):
        module = ast.parse(Path(__file__).with_name('views.py').read_text(encoding='utf-8-sig'))
        functions = [n for n in module.body if isinstance(n, ast.FunctionDef) and n.name in {'candidate_certificate_settings_api', 'admin_candidate_certificate_template_api'}]
        for n in functions: n.decorator_list = []
        forbidden = object()
        namespace = dict(_require_admin=lambda request: forbidden, settings_response=Mock(), template_response=Mock(),
                         JsonResponse=lambda data, status=200: SimpleNamespace(status_code=status))
        exec(compile(ast.Module(body=functions, type_ignores=[]), '<coc routes>', 'exec'), namespace)
        request = SimpleNamespace(method='GET', path='/api/admin/certificate-of-candidacy/settings/', session={'student_id': 'student'})
        self.assertIs(namespace['candidate_certificate_settings_api'](request), forbidden)
        self.assertIs(namespace['admin_candidate_certificate_template_api'](request, 'usg'), forbidden)
        request.session = {}
        self.assertEqual(namespace['candidate_certificate_settings_api'](request).status_code, 401)
        namespace['settings_response'].assert_not_called()
        namespace['template_response'].assert_not_called()


if __name__ == '__main__':
    unittest.main()
