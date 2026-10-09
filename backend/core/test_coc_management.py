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
CONFIG.update(dict.fromkeys(coc.FORMATTING_FIELDS, False))
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
                self.assertRegex(text, r'Academic Year\s+2025 - 2026')
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
                matching = [(value, tm, size) for value, tm, size in runs if value.strip() == year]
                self.assertEqual(len(matching), 1)
                _, tm, size = matching[0]
                self.assertAlmostEqual(tm[5], 202.82)
                suffix = ', and I do hereby declare my intention and desire to be'
                following = [(value, pos, font_size) for value, pos, font_size in runs if value.strip() == suffix]
                self.assertGreaterEqual(len(following), 1)
                _, pos, font_size = following[-1]
                self.assertAlmostEqual(pos[4], tm[4] + stringWidth(year, 'Times-Roman', size), places=4)
                self.assertLessEqual(pos[4] + stringWidth(suffix, 'Times-Roman', font_size), 576.01)
                operations = ContentStream(page.get_contents(), page.pdf).operations
                move = next(args for args, op in reversed(operations) if op == b'm')
                line = next(args for args, op in reversed(operations) if op == b'l')
                self.assertAlmostEqual(float(move[0]), tm[4], places=4)
                self.assertAlmostEqual(float(line[0]), pos[4], places=4)
        self.assertEqual(original, (FORMS / 'department_certificate_of_candidacy.pdf').read_bytes())

    def test_format_flags_validate_json_and_query_values(self):
        self.assertEqual(coc.formatting_flags({}), dict.fromkeys(coc.FORMATTING_FIELDS, False))
        self.assertTrue(coc.formatting_flags({'name_is_bold': 'true'}, query=True)['name_is_bold'])
        self.assertFalse(coc.formatting_flags({'year_is_italic': 'false'}, query=True)['year_is_italic'])
        for value in ('false', 1, None, [], {}):
            with self.subTest(value=value), self.assertRaises(ValueError):
                coc.formatting_flags({'name_is_bold': value})
        with self.assertRaises(ValueError):
            coc.formatting_flags({'year_is_bold': 'maybe'}, query=True)

    def test_both_forms_embed_selected_year_and_name_typefaces(self):
        from reportlab.pdfbase.pdfmetrics import stringWidth
        for filename in ('certificate_of_candidacy.pdf', 'department_certificate_of_candidacy.pdf'):
            original = (FORMS / filename).read_bytes()
            for bold, italic, font in ((False, False, '/Times-Roman'), (True, False, '/Times-Bold'),
                                       (False, True, '/Times-Italic'), (True, True, '/Times-BoldItalic')):
                with self.subTest(filename=filename, font=font):
                    config = {**CONFIG, 'chairperson_name': 'Formatted Chair', 'name_is_bold': bold,
                              'name_is_italic': italic, 'year_is_bold': bold, 'year_is_italic': italic}
                    pdf = coc.decorate_pdf(original, config)
                    runs = []
                    PdfReader(io.BytesIO(pdf)).pages[0].extract_text(visitor_text=lambda value, cm, tm, f, size:
                        runs.append((value.strip(), tm, f.get('/BaseFont') if f else None, size)))
                    for expected in (config['academic_year'], config['chairperson_name']):
                        match = [run for run in runs if run[0] == expected]
                        self.assertEqual(len(match), 1)
                        self.assertEqual(match[0][2], font)
                    if filename.startswith('department'):
                        year = next(run for run in runs if run[0] == config['academic_year'])
                        suffix = [run for run in runs if run[0].startswith(', and I do hereby')][-1]
                        self.assertAlmostEqual(suffix[1][4], year[1][4] + stringWidth(year[0], font[1:], year[3]), places=4)
                        self.assertEqual(suffix[2], '/Times-Roman')

    def test_formatting_round_trips_to_shared_settings_and_frozen_issuance(self):
        flags = dict(name_is_bold=True, name_is_italic=False, year_is_bold=False, year_is_italic=True)
        config = {**CONFIG, **flags}
        cur = Mock(); cur.fetchone.side_effect = [(2025, 2026, CONFIG['chairperson_name'], *flags.values()), None]
        request = SimpleNamespace(method='POST', session={'role': 'admin', 'student_id': 'admin'},
                                  body=json.dumps({'form_kind': 'department', **config}).encode())
        with patch.object(coc, 'connection', SimpleNamespace(cursor=lambda: nullcontext(cur))), patch.object(coc, 'get_token', return_value='csrf'):
            response = coc.settings_response(request, 3)
        self.assertEqual(response.status_code, 200)
        values = cur.execute.call_args_list[0].args[1]
        self.assertEqual(values[7:11], list(flags.values()))
        self.assertEqual(values[18:22], list(flags.values()))
        data = json.loads(response.content)
        self.assertEqual(data['forms']['usg'], config)
        self.assertEqual(data['forms']['department'], config)
        cur = Mock(); cur.fetchone.side_effect = [None, ((FORMS / 'department_certificate_of_candidacy.pdf').read_bytes(),),
                                                  (2025, 2026, CONFIG['chairperson_name'], *flags.values())]
        coc.issue_certificate(cur, {'id': 7, 'election_id': 3, 'organization': 'SITE'}, APPROVED)
        self.assertEqual(json.loads(cur.execute.call_args.args[1][3]), config)

    def test_draft_get_and_post_use_formatting_and_reject_invalid_flags(self):
        for method in ('GET', 'POST'):
            params = dict(draft='1', academic_year_start='2026', academic_year_end='2027',
                          chairperson_name='Styled Chair', year_is_bold='true' if method == 'GET' else True,
                          name_is_italic='true' if method == 'GET' else True)
            request = SimpleNamespace(method=method, GET=params, body=json.dumps(params).encode())
            with patch.object(coc, 'connection') as connection:
                response = coc.template_response(request, 3, 'department')
                connection.cursor.assert_not_called()
            self.assertEqual(response.status_code, 200)
            runs = []
            PdfReader(io.BytesIO(response.content)).pages[0].extract_text(visitor_text=lambda value, cm, tm, font, size:
                runs.append((value.strip(), font.get('/BaseFont') if font else None)))
            self.assertIn(('2026 - 2027', '/Times-Bold'), runs)
            self.assertIn(('Styled Chair', '/Times-Italic'), runs)
            params['year_is_bold'] = 'invalid'
            request.body = json.dumps(params).encode()
            self.assertEqual(coc.template_response(request, 3, 'department').status_code, 400)

    def test_pending_preview_does_not_invent_approval_date(self):
        pdf = coc.decorate_pdf((FORMS / 'certificate_of_candidacy.pdf').read_bytes(), CONFIG)
        text = PdfReader(io.BytesIO(pdf)).pages[0].extract_text()
        self.assertRegex(text, r'Academic Year\s+2025 - 2026')
        self.assertNotIn('day of October year 2026', text)
        self.assertIn('at USTP Oroquieta Campus', text)

    def test_approval_saves_separate_immutable_pdf_and_settings_snapshot(self):
        cur = Mock()
        original = (FORMS / 'certificate_of_candidacy.pdf').read_bytes()
        cur.fetchone.side_effect = [None, (original,), (2025, 2026, 'Maria PeÃ±a', False, False, False, False)]
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
        cur = Mock(); cur.fetchone.return_value = (2025, 2026, CONFIG['chairperson_name'], False, False, False, False)
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
        cur = Mock(); cur.fetchone.side_effect = [(2025, 2026, 'Maria PeÃ±a', False, False, False, False), None]
        request = SimpleNamespace(method='POST', session={'role': 'admin', 'student_id': 'admin'},
                                  body=json.dumps({'form_kind': 'usg', **CONFIG}).encode())
        with patch.object(coc, 'connection', SimpleNamespace(cursor=lambda: nullcontext(cur))), patch.object(coc, 'get_token', return_value='csrf'):
            result = coc.settings_response(request, 3)
        self.assertEqual(result.status_code, 200)
        values = cur.execute.call_args_list[0].args[1]
        self.assertEqual(values, [3, 'usg', 2025, 2026, CONFIG['chairperson_name'], 'admin', None, False, False, False, False,
                                  3, 'department', 2025, 2026, CONFIG['chairperson_name'], 'admin', None, False, False, False, False, False])
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
        self.assertRegex(text, r'Academic Year\s+2027 - 2028')
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
