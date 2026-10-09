"""Final-only signing, signature validation and archived edition preservation."""
import ast
import base64
from contextlib import nullcontext
from datetime import datetime, timezone
import io
import json
import os
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import Mock, patch

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
from core import coc_chairperson_signatures as sig
from core import coc_management as coc
from pypdf import PdfReader
from PIL import Image, ImageDraw

CONFIG = dict(academic_year='2025 - 2026', chairperson_name='Sample Chair')
APPROVED = datetime(2026, 10, 9, 10, 30, tzinfo=timezone.utc)
FORMS = Path(__file__).with_name('forms')


def signature_png(blank=False):
    image = Image.new('RGBA', (240, 100), 'white')
    if not blank:
        ImageDraw.Draw(image).line([(20, 70), (55, 15), (90, 65), (140, 20), (210, 45)], fill='black', width=4)
    output = io.BytesIO(); image.save(output, 'PNG'); return output.getvalue()


class ChairpersonSignatureTests(unittest.TestCase):
    def test_png_is_cropped_and_white_background_becomes_transparent(self):
        raw = sig.decode_signature(base64.b64encode(signature_png()).decode())
        image = Image.open(io.BytesIO(raw))
        self.assertEqual(image.mode, 'RGBA')
        self.assertLess(image.width, 240)
        self.assertEqual(image.getpixel((0, 0))[3], 0)

    def test_invalid_empty_blank_and_oversized_signatures(self):
        self.assertIsNone(sig.decode_signature(''))
        for encoded in ['bad-base64!', base64.b64encode(b'not-png').decode(),
                        base64.b64encode(signature_png(True)).decode(), 'A' * (2 * 1024 * 1024)]:
            with self.subTest(encoded=encoded[:15]), self.assertRaises(ValueError):
                sig.decode_signature(encoded)

    def test_signature_overlays_both_layouts_without_changing_text_or_date(self):
        signature = sig.decode_signature(base64.b64encode(signature_png()).decode())
        for filename in ['certificate_of_candidacy.pdf', 'department_certificate_of_candidacy.pdf']:
            with self.subTest(filename=filename):
                unsigned = coc.decorate_pdf((FORMS / filename).read_bytes(), CONFIG, APPROVED)
                signed = sig.overlay_signature(unsigned, signature)
                before = PdfReader(io.BytesIO(unsigned)).pages[0]
                after = PdfReader(io.BytesIO(signed)).pages[0]
                self.assertEqual(before.extract_text(), after.extract_text())
                self.assertEqual(before.mediabox, after.mediabox)
                self.assertGreater(len(after.images), len(before.images))

    def test_finalization_saves_immutable_signed_edition_without_updating_initial_pdf(self):
        unsigned = coc.decorate_pdf((FORMS / 'certificate_of_candidacy.pdf').read_bytes(), CONFIG, APPROVED)
        signature = sig.decode_signature(base64.b64encode(signature_png()).decode())
        cur = Mock(); cur.fetchone.side_effect = [None, (unsigned, CONFIG), (signature, 'Sample Chair')]
        sig.finalize_certificate(cur, {'id': 7, 'election_id': 3}, APPROVED)
        sql, values = cur.execute.call_args.args
        self.assertIn('candidate_certificate_finalizations', sql)
        self.assertIn('ON CONFLICT (application_id) DO NOTHING', sql)
        self.assertNotEqual(values[1], unsigned)
        self.assertEqual(values[3], signature)
        self.assertEqual(json.loads(values[4]), CONFIG)
        self.assertEqual(values[5], APPROVED)
        self.assertFalse(any('UPDATE' in call.args[0] for call in cur.execute.call_args_list))

    def test_missing_signature_and_different_chair_block_signing(self):
        for row in [(None, 'Sample Chair'), (signature_png(), 'Different Chair')]:
            cur = Mock(); cur.fetchone.side_effect = [None, (b'pdf', CONFIG), row]
            with self.subTest(row=row[1]), self.assertRaises(ValueError):
                sig.finalize_certificate(cur, {'id': 7, 'election_id': 3})
            self.assertFalse(any('INSERT' in call.args[0] for call in cur.execute.call_args_list))

    def test_existing_final_certificate_and_legacy_without_coc_are_preserved(self):
        for rows in [[(7,)], [None, None]]:
            cur = Mock(); cur.fetchone.side_effect = rows
            sig.finalize_certificate(cur, {'id': 7})
            self.assertFalse(any('INSERT' in call.args[0] for call in cur.execute.call_args_list))

    def test_admin_draft_can_preview_signature_without_writing_settings(self):
        request = SimpleNamespace(method='POST', body=json.dumps(dict(form_kind='usg', academic_year_start=2025,
            academic_year_end=2026, chairperson_name='Sample Chair', chairperson_signature_base64=base64.b64encode(signature_png()).decode())).encode())
        with patch.object(coc, 'connection') as connection:
            response = coc.template_response(request, 3, 'usg')
            connection.cursor.assert_not_called()
        self.assertEqual(response.status_code, 200)

    def test_student_settings_do_not_expose_reusable_chairperson_signature(self):
        cur = Mock(); cur.fetchone.return_value = (2025, 2026, 'Sample Chair')
        with patch.object(coc, 'connection', SimpleNamespace(cursor=lambda: nullcontext(cur))), patch.object(coc, 'read_signature') as read:
            response = coc.settings_response(SimpleNamespace(method='GET', session={'role': 'student'}), 3)
            read.assert_not_called()
        self.assertIsNone(json.loads(response.content)['chairperson_signature_base64'])

    def test_saving_signature_writes_same_bytes_to_both_forms(self):
        raw = signature_png(); encoded = base64.b64encode(raw).decode()
        normalized = sig.decode_signature(encoded)
        cur = Mock(); cur.fetchone.side_effect = [(2025, 2026, 'Sample Chair'), (normalized, 'Sample Chair')]
        request = SimpleNamespace(method='POST', session={'role': 'admin', 'student_id': 'admin'},
                                  body=json.dumps(dict(form_kind='usg', academic_year_start=2025,
                                      academic_year_end=2026, chairperson_name='Sample Chair', chairperson_signature_base64=encoded)).encode())
        with patch.object(coc, 'connection', SimpleNamespace(cursor=lambda: nullcontext(cur))), patch.object(coc, 'get_token', return_value='csrf'):
            response = coc.settings_response(request, 3)
        self.assertEqual(response.status_code, 200)
        values = cur.execute.call_args_list[0].args[1]
        self.assertEqual(values[6], normalized); self.assertEqual(values[17], normalized)
        self.assertTrue(values[-1])

    def test_download_only_selects_final_copy_for_approved_owner_or_admin(self):
        from core import candidate_certificates as archive
        cur = Mock(); cur.fetchone.return_value = (b'%PDF-final', 'final-sha')
        with patch.object(archive, 'connection', SimpleNamespace(cursor=lambda: nullcontext(cur))):
            response = archive.candidate_certificate_api(SimpleNamespace(method='GET', session={'student_id': 'owner', 'role': 'student'}), 7)
        sql, params = cur.execute.call_args.args
        self.assertIn("AND a.status = 'approved'", sql)
        self.assertIn('a.student_id = %s OR %s', sql)
        self.assertEqual(params, [7, 'owner', False])
        self.assertEqual(response['X-Certificate-SHA256'], 'final-sha')

    def approval(self, stage, grades='grades', signing_error=None):
        module = ast.parse(Path(__file__).with_name('views.py').read_text(encoding='utf-8-sig'))
        fn = next(n for n in module.body if isinstance(n, ast.FunctionDef) and n.name == 'admin_candidate_application_decision_api')
        fn.decorator_list = []
        fields = ['id', 'student_id', 'status', 'candidate_type', 'enrollment_certificate_url', 'grades_url', 'good_moral_url']
        cur = Mock(); cur.description = [(field,) for field in fields]
        cur.fetchone.side_effect = [(7, 'student', stage, 'Independent', 'enrollment', grades, 'moral'), (8,)]
        sign = Mock(side_effect=signing_error)
        namespace = dict(_require_admin=lambda request: None, _json_request_body=lambda request: {'id': 7, 'action': 'approve'},
                         _ensure_candidate_applications_table=Mock(), _ensure_election_scoped_tables=Mock(),
                         transaction=SimpleNamespace(atomic=nullcontext), connection=SimpleNamespace(cursor=lambda: nullcontext(cur)),
                         identity_row=lambda cols, row: dict(zip(cols, row)), issue_certificate=Mock(), finalize_certificate=sign,
                         _insert_user_notification_for_student=Mock(), settings=SimpleNamespace(DEBUG=True),
                         JsonResponse=lambda data, status=200: SimpleNamespace(data=data, status_code=status))
        exec(compile(ast.Module(body=[fn], type_ignores=[]), '<approval>', 'exec'), namespace)
        result = namespace[fn.name](SimpleNamespace(session={'student_id': 'admin'}))
        return result, sign, cur

    def test_initial_approval_never_signs_and_final_approval_signs(self):
        initial, sign, _ = self.approval('pending')
        self.assertEqual(initial.data['status'], 'requirements_pending'); sign.assert_not_called()
        final, sign, _ = self.approval('requirements_review')
        self.assertEqual(final.data['status'], 'approved'); sign.assert_called_once()

    def test_incomplete_documents_and_rejected_filing_never_sign(self):
        for stage, grades in [('requirements_review', ''), ('rejected', 'grades')]:
            response, sign, _ = self.approval(stage, grades)
            self.assertEqual(response.status_code, 409); sign.assert_not_called()

    def test_signature_error_blocks_publication(self):
        response, _, cur = self.approval('requirements_review', signing_error=ValueError('Signature required'))
        self.assertEqual(response.status_code, 409)
        self.assertFalse(any('INSERT INTO candidates_registration' in call.args[0] for call in cur.execute.call_args_list))


if __name__ == '__main__':
    unittest.main()
