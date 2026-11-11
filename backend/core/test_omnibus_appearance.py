import json
from unittest import TestCase
from unittest.mock import MagicMock, patch
from django.test import RequestFactory
from django.core.files.uploadedfile import SimpleUploadedFile
from core import omnibus_appearance as appearance

class OmnibusAppearanceTests(TestCase):
    def test_defaults_and_reorder(self):
        pages = appearance.default_pages()
        self.assertEqual(len(pages), 14)
        self.assertEqual(appearance.validate_pages(pages[::-1], [])[0]['default_index'], 13)

    def test_invalid_pages_and_external_images(self):
        page = appearance.default_pages()[0]
        for pages in ([], [page] * 31, [page, page], [dict(page, default_index=True)], [dict(page, default_index=14)], [dict(page, image_url='https://example.com/a.jpg')]):
            with self.subTest(pages=pages):
                self.assertRaises(ValueError, appearance.validate_pages, pages, [])

    def test_saved_images_are_election_scoped(self):
        page = dict(appearance.default_pages()[0], image_url='https://res.cloudinary.com/demo/image/upload/a.jpg')
        self.assertRaises(ValueError, appearance.validate_pages, [page], [])
        self.assertEqual(appearance.validate_pages([page], [page])[0], page)

    def test_read_uses_exact_election(self):
        cursor = MagicMock(); cursor.fetchone.return_value = (appearance.default_pages()[::-1],)
        with patch.object(appearance.connection, 'cursor') as mocked:
            mocked.return_value.__enter__.return_value = cursor
            self.assertEqual(appearance.get_omnibus_pages(8)[0]['default_index'], 13)
        cursor.execute.assert_called_once_with('SELECT pages FROM election_omnibus_pages WHERE election_id = %s', [8])

    def request(self, method='post', data=None):
        request = getattr(RequestFactory(), method)('/api/admin/elections/8/omnibus/', data=data or {})
        return request

    def test_auth_required(self):
        with patch('core.views._require_admin', return_value='forbidden'), patch.object(appearance.connection, 'cursor') as cursor:
            self.assertEqual(appearance.omnibus_appearance_api(self.request(), 8), 'forbidden')
            cursor.assert_not_called()

    def test_missing_image_cannot_publish_new_page(self):
        request = self.request(data={'pages': json.dumps([dict(id='new', default_index=None, image_url=None)])})
        with patch('core.views._require_admin', return_value=None), patch.object(appearance.connection, 'cursor'), patch.object(appearance, 'get_omnibus_pages', return_value=[]):
            response = appearance.omnibus_appearance_api(request, 8)
        self.assertEqual(response.status_code, 400)

    def test_upload_failure_preserves_saved_pages(self):
        page = dict(id='new', default_index=None, image_url=None)
        request = self.request(data={'pages': json.dumps([page]), 'image_new': SimpleUploadedFile('page.jpg', b'image', content_type='image/jpeg')})
        cursor = MagicMock()
        with patch('core.views._require_admin', return_value=None), patch.object(appearance.connection, 'cursor') as mocked, patch.object(appearance, 'get_omnibus_pages', return_value=[]), patch.object(appearance, 'validated_background', return_value=b'valid'), patch.object(appearance, 'upload_image_bytes', side_effect=RuntimeError('unavailable')):
            mocked.return_value.__enter__.return_value = cursor
            response = appearance.omnibus_appearance_api(request, 8)
        self.assertEqual(response.status_code, 503)
        self.assertFalse(any('INSERT' in str(call) for call in cursor.execute.call_args_list))

    def test_publish_upload_and_order(self):
        url = 'https://res.cloudinary.com/demo/image/upload/page.jpg'
        page = dict(id='new', default_index=None, image_url=None)
        request = self.request(data={'pages':json.dumps([page, appearance.default_pages()[3]]), 'image_new':SimpleUploadedFile('page.jpg', b'image', content_type='image/jpeg')})
        with patch('core.views._require_admin', return_value=None), patch.object(appearance.connection, 'cursor'), patch.object(appearance, 'get_omnibus_pages', return_value=[]), patch.object(appearance, 'validated_background', return_value=b'valid'), patch.object(appearance, 'upload_image_bytes', return_value=(url,'id')):
            response = appearance.omnibus_appearance_api(request, 8)
        self.assertEqual(response.status_code, 200)
        pages = json.loads(response.content)['pages']
        self.assertEqual(pages[0]['image_url'], url)
        self.assertEqual(pages[1]['default_index'], 3)
