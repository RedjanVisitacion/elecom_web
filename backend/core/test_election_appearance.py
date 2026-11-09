import io
import json
from unittest import TestCase
from unittest.mock import MagicMock, patch

from PIL import Image
from django.core.files.uploadedfile import SimpleUploadedFile
from django.middleware.csrf import CsrfViewMiddleware
from django.test import RequestFactory
from core import election_appearance as appearance


def image_file(size=(800, 360), format='PNG'):
    stream = io.BytesIO()
    Image.new('RGB', size, 'navy').save(stream, format=format)
    return SimpleUploadedFile('background.png', stream.getvalue(), content_type='image/png')


class FilingAppearanceTests(TestCase):
    def test_valid_image_is_reencoded_as_jpeg(self):
        raw = appearance.validated_background(image_file())
        with Image.open(io.BytesIO(raw)) as image:
            self.assertEqual(image.format, 'JPEG')
            self.assertEqual(image.size, (800, 360))

    def test_fake_image_and_oversized_dimensions_are_rejected(self):
        for upload in [None, SimpleUploadedFile('fake.png', b'not an image'), image_file((4100, 150)), image_file((99, 200))]:
            with self.subTest(upload=upload):
                self.assertRaises(ValueError, appearance.validated_background, upload)

    def test_size_limit_applies_before_read(self):
        upload = MagicMock(size=appearance.MAX_BYTES + 1)
        self.assertRaises(ValueError, appearance.validated_background, upload)
        upload.read.assert_not_called()

    def test_only_https_cloudinary_delivery_urls_are_returned(self):
        for url in ['http://res.cloudinary.com/x', 'https://evil.example/test.png', 'javascript:alert(1)', 'https://res.cloudinary.com.evil.example/a']:
            self.assertEqual(appearance.safe_background_url(url), '')
        url = 'https://res.cloudinary.com/demo/image/upload/v2/card.jpg'
        self.assertEqual(appearance.safe_background_url(url), url)

    def test_students_cannot_modify_card(self):
        request = RequestFactory().post('/api/admin/elections/7/appearance/')
        request.session = {'role': 'student'}
        self.assertEqual(appearance.election_appearance_api(request, 7).status_code, 403)

    def test_upload_requires_csrf(self):
        request = RequestFactory().post('/api/admin/elections/7/appearance/')
        response = CsrfViewMiddleware(lambda request: None).process_view(request, appearance.election_appearance_api, (), {'election_id': 7})
        self.assertEqual(response.status_code, 403)

    def test_missing_election_is_not_created(self):
        cursor = MagicMock()
        cursor.fetchone.return_value = None
        request = RequestFactory().get('/api/admin/elections/99/appearance/')
        request.session = {'role': 'admin'}
        with patch.object(appearance.connection, 'cursor') as cur:
            cur.return_value.__enter__.return_value = cursor
            response = appearance.election_appearance_api(request, 99)
        self.assertEqual(response.status_code, 404)
        self.assertEqual(cursor.execute.call_count, 1)

    def test_successful_save_is_scoped_and_returns_new_image(self):
        cursor = MagicMock()
        cursor.fetchone.return_value = (7,)
        url = 'https://res.cloudinary.com/demo/image/upload/v2/new.jpg'
        request = RequestFactory().post('/api/admin/elections/7/appearance/', {'background': image_file()})
        request.session = {'role': 'admin'}
        with patch.object(appearance.connection, 'cursor') as cur, patch.object(appearance, 'upload_image_bytes', return_value=(url, 'new-image')):
            cur.return_value.__enter__.return_value = cursor
            response = appearance.election_appearance_api(request, 7)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(json.loads(response.content)['background_url'], url)
        self.assertEqual(cursor.execute.call_args.args[1], [7, url, 'new-image'])

    def test_upload_failure_preserves_saved_record(self):
        cursor = MagicMock()
        cursor.fetchone.return_value = (7,)
        request = RequestFactory().post('/api/admin/elections/7/appearance/', {'background': image_file()})
        request.session = {'role': 'admin'}
        with patch.object(appearance.connection, 'cursor') as cur, patch.object(appearance, 'upload_image_bytes', side_effect=RuntimeError('unavailable')):
            cur.return_value.__enter__.return_value = cursor
            response = appearance.election_appearance_api(request, 7)
        self.assertEqual(response.status_code, 503)
        self.assertFalse(any('INSERT INTO' in call.args[0] or 'DELETE FROM' in call.args[0] for call in cursor.execute.call_args_list))

    def test_reset_only_removes_selected_election_background(self):
        cursor = MagicMock()
        cursor.fetchone.return_value = (7,)
        request = RequestFactory().delete('/api/admin/elections/7/appearance/')
        request.session = {'role': 'admin'}
        with patch.object(appearance.connection, 'cursor') as cur:
            cur.return_value.__enter__.return_value = cursor
            response = appearance.election_appearance_api(request, 7)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(cursor.execute.call_args.args, ('DELETE FROM election_mobile_appearance WHERE election_id = %s', [7]))
        self.assertIsNone(json.loads(response.content)['background_url'])

    def test_saved_url_is_read_for_exact_election(self):
        cursor = MagicMock()
        cursor.fetchone.return_value = ('https://res.cloudinary.com/demo/image/upload/card.jpg',)
        with patch.object(appearance.connection, 'cursor') as cur:
            cur.return_value.__enter__.return_value = cursor
            self.assertIsNotNone(appearance.get_filing_background(7))
        self.assertEqual(cursor.execute.call_args.args[1], [7])

    def test_pre_migration_mobile_api_can_use_default(self):
        with patch.object(appearance.connection, 'cursor', side_effect=RuntimeError('table not yet installed')):
            self.assertIsNone(appearance.get_filing_background(7))
