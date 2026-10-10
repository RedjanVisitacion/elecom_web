import json
import os
from contextlib import nullcontext
from types import SimpleNamespace
import unittest
from unittest.mock import Mock, patch

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
from django.http import JsonResponse
from core import developer_gallery as api


class GalleryTests(unittest.TestCase):
    def setUp(self):
        self.request = SimpleNamespace(method='GET', GET={})
        self.cursor = Mock()

    def test_password_gate_prevents_database_access(self):
        with patch.object(api, '_developer_admin', return_value=JsonResponse({'ok': False}, status=403)), patch.object(api, 'connection') as db:
            self.assertEqual(api.developer_gallery_api(self.request).status_code, 403)
            db.cursor.assert_not_called()

    def test_invalid_page(self):
        self.request.GET = {'page': '-1'}
        with patch.object(api, '_developer_admin', return_value=None):
            self.assertEqual(api.developer_gallery_api(self.request).status_code, 400)

    def test_grouped_images_and_unsafe_url_rejected(self):
        self.cursor.fetchall.side_effect = [
            [('users', 'student_id'), ('users', 'photo_url'), ('face_enrollments', 'student_id'), ('face_enrollments', 'face_image_url'), ('face_enrollments', 'enrolled_at')],
            [(1, 'ID1', 'First', '', 'Last')],
            [('ID1', 'https://example.com/a.jpg', 'Profile photo', None, None),
             ('ID1', 'https://example.com/a.jpg', 'Profile photo', None, None),
             ('ID1', 'https://example.com/b.jpg', 'Face enrollment', '2026-10-10', 'active'),
             ('ID1', 'javascript:alert(1)', 'Profile photo', None, None)],
        ]
        with patch.object(api, '_developer_admin', return_value=None), patch.object(api, 'connection', SimpleNamespace(cursor=lambda: nullcontext(self.cursor))):
            response = api.developer_gallery_api(self.request)
        result = json.loads(response.content)
        self.assertEqual(result['users'][0]['name'], 'First Last')
        self.assertEqual(len(result['users'][0]['images']), 2)
        self.assertEqual(response['Cache-Control'], 'private, no-store')
        self.assertNotIn('candidate_applications', self.cursor.execute.call_args_list[1].args[0])

    def test_pagination_and_search_parameters(self):
        self.request.GET = {'page': '2', 'q': 'name%'}
        self.cursor.fetchall.side_effect = [[('users', 'student_id'), ('users', 'photo_url')],
            [(i, str(i), 'Name', '', 'Last') for i in range(21)], []]
        with patch.object(api, '_developer_admin', return_value=None), patch.object(api, 'connection', SimpleNamespace(cursor=lambda: nullcontext(self.cursor))):
            response = api.developer_gallery_api(self.request)
        result = json.loads(response.content)
        self.assertTrue(result['has_more'])
        self.assertEqual(len(result['users']), 20)
        self.assertEqual(self.cursor.execute.call_args_list[1].args[1], ['%name\\%%', 20])
