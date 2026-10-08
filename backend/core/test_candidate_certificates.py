"""Archive validation, access control and immutable legacy preservation."""
import base64
from contextlib import nullcontext
import hashlib
import json
import os
from types import SimpleNamespace
import unittest
from unittest.mock import Mock, patch

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
from django.core.files.uploadedfile import SimpleUploadedFile
from core import candidate_certificates as coc

PDF = b'%PDF-1.7\narchived test\n%%EOF\n'
PNG = b'\x89PNG\r\n\x1a\n' + b'signature'


class CertificateTests(unittest.TestCase):
    def request(self, pdf=PDF, signature=PNG, method='GET', student='owner', role='student'):
        return SimpleNamespace(
            method=method, session={'student_id': student, 'role': role},
            FILES={'certificate_pdf': SimpleUploadedFile('coc.pdf', pdf)},
            POST={'signature_base64': base64.b64encode(signature).decode(),
                  'email': 'student@example.com', 'party_code': 'secret'},
        )

    def test_valid_upload_preserves_bytes_and_excludes_party_secret(self):
        value = coc.read_certificate_upload(self.request())
        self.assertEqual(value['pdf'], PDF)
        self.assertEqual(value['signature'], PNG)
        self.assertEqual(value['sha256'], hashlib.sha256(PDF).hexdigest())
        self.assertNotIn('party_code', value['fields'])

    def test_invalid_pdf_and_signature_are_rejected(self):
        for pdf in (b'', b'not-pdf', b'%PDF-1.7 incomplete', PDF + b'x' * coc.MAX_PDF_BYTES):
            with self.assertRaises(ValueError):
                coc.read_certificate_upload(self.request(pdf=pdf))
        with self.assertRaises(ValueError):
            coc.read_certificate_upload(self.request(signature=b'not-png'))
        request = self.request()
        request.POST['signature_base64'] = '?' * 20
        with self.assertRaises(ValueError):
            coc.read_certificate_upload(request)

    def test_legacy_upload_can_preserve_pdf_without_original_signature(self):
        self.assertEqual(coc.read_certificate_upload(self.request(signature=b''), False)['pdf'], PDF)
        with self.assertRaises(ValueError):
            coc.read_certificate_upload(self.request(signature=b''))

    def test_archival_does_not_overwrite_existing_pdf(self):
        cursor = Mock()
        coc.save_certificate(cursor, 7, 'owner', coc.read_certificate_upload(self.request()))
        sql, values = cursor.execute.call_args.args
        self.assertIn('ON CONFLICT (application_id) DO NOTHING', sql)
        self.assertEqual(values[1], PDF)
        self.assertEqual(json.loads(values[3])['student_id'], 'owner')

    def download(self, student='owner', role='student', row=(PDF, 'sha')):
        cursor = Mock()
        cursor.fetchone.return_value = row
        with patch.object(coc, 'connection', SimpleNamespace(cursor=lambda: nullcontext(cursor))):
            result = coc.candidate_certificate_api(self.request(student=student, role=role), 7)
        return result, cursor

    def test_unauthenticated_cannot_download(self):
        result, cursor = self.download(student='')
        self.assertEqual(result.status_code, 401)
        cursor.execute.assert_not_called()

    def test_download_is_scoped_to_owner_or_admin(self):
        for role, admin in [('student', False), ('admin', True)]:
            result, cursor = self.download(role=role)
            self.assertEqual(cursor.execute.call_args.args[1], [7, 'owner', admin])
            self.assertIn('a.student_id = %s OR %s', cursor.execute.call_args.args[0])
            self.assertEqual(result.content, PDF)
            self.assertEqual(result['Cache-Control'], 'private, no-store')

    def test_missing_or_other_students_certificate_returns_404(self):
        result, _ = self.download(student='other', row=None)
        self.assertEqual(result.status_code, 404)

    def test_legacy_post_checks_owner_before_reading_upload(self):
        cursor = Mock()
        cursor.fetchone.return_value = ('other',)
        with patch.object(coc, 'connection', SimpleNamespace(cursor=lambda: nullcontext(cursor))), \
                patch.object(coc, 'transaction', SimpleNamespace(atomic=nullcontext)), \
                patch.object(coc, 'read_certificate_upload') as upload:
            response = coc.candidate_certificate_api(self.request(method='POST'), 7)
        self.assertEqual(response.status_code, 404)
        upload.assert_not_called()

    def test_existing_legacy_archive_is_not_replaced(self):
        cursor = Mock()
        cursor.fetchone.side_effect = [('owner',), ('original-sha',)]
        with patch.object(coc, 'connection', SimpleNamespace(cursor=lambda: nullcontext(cursor))), \
                patch.object(coc, 'transaction', SimpleNamespace(atomic=nullcontext)), \
                patch.object(coc, 'save_certificate') as save:
            response = coc.candidate_certificate_api(self.request(method='POST'), 7)
        self.assertEqual(response.status_code, 200)
        save.assert_not_called()


if __name__ == '__main__':
    unittest.main()
