import json
from unittest import TestCase
from unittest.mock import MagicMock, patch
from django.test import RequestFactory
from django.core.files.uploadedfile import SimpleUploadedFile
from core import topbar_appearance as appearance

class TopbarAppearanceTests(TestCase):
    def request(self, method='post', data=None):
        return getattr(RequestFactory(),method)('/api/admin/elections/8/topbar/',data=data or {})

    def test_permissions(self):
        with patch('core.views._require_admin',return_value='forbidden'),patch.object(appearance.connection,'cursor') as cursor:
            self.assertEqual(appearance.topbar_appearance_api(self.request(),8),'forbidden')
            cursor.assert_not_called()

    def test_read_scoped_and_unsafe_urls_fall_back(self):
        cursor=MagicMock();cursor.fetchone.return_value=('https://evil.example/image.jpg',)
        with patch.object(appearance.connection,'cursor') as mocked:
            mocked.return_value.__enter__.return_value=cursor
            self.assertIsNone(appearance.get_topbar_background(8))
        cursor.execute.assert_called_once_with('SELECT image_url FROM election_topbar_appearance WHERE election_id = %s',[8])

    def test_missing_image_rejected(self):
        with patch('core.views._require_admin',return_value=None),patch.object(appearance.connection,'cursor'):
            self.assertEqual(appearance.topbar_appearance_api(self.request(),8).status_code,400)

    def test_successful_upload_publishes_selected_election(self):
        url='https://res.cloudinary.com/demo/image/upload/header.jpg'
        request=self.request(data={'background':SimpleUploadedFile('crop.jpg',b'image',content_type='image/jpeg')})
        cursor=MagicMock()
        with patch('core.views._require_admin',return_value=None),patch.object(appearance.connection,'cursor') as mocked,patch.object(appearance,'validated_background',return_value=b'valid'),patch.object(appearance,'upload_image_bytes',return_value=(url,'id')):
            mocked.return_value.__enter__.return_value=cursor
            response=appearance.topbar_appearance_api(request,8)
        self.assertEqual(json.loads(response.content)['image_url'],url)
        self.assertEqual(cursor.execute.call_args.args[1],[8,url])

    def test_upload_failure_preserves_previous_setting(self):
        request=self.request(data={'background':SimpleUploadedFile('crop.jpg',b'image',content_type='image/jpeg')})
        cursor=MagicMock()
        with patch('core.views._require_admin',return_value=None),patch.object(appearance.connection,'cursor') as mocked,patch.object(appearance,'validated_background',return_value=b'valid'),patch.object(appearance,'upload_image_bytes',side_effect=RuntimeError('unavailable')):
            mocked.return_value.__enter__.return_value=cursor
            response=appearance.topbar_appearance_api(request,8)
        self.assertEqual(response.status_code,503)
        self.assertFalse(any('INSERT' in str(call) for call in cursor.execute.call_args_list))

    def test_restore_only_selected_election(self):
        cursor=MagicMock()
        with patch('core.views._require_admin',return_value=None),patch.object(appearance.connection,'cursor') as mocked:
            mocked.return_value.__enter__.return_value=cursor
            response=appearance.topbar_appearance_api(self.request('delete'),8)
        self.assertIsNone(json.loads(response.content)['image_url'])
        cursor.execute.assert_called_with('DELETE FROM election_topbar_appearance WHERE election_id = %s',[8])
