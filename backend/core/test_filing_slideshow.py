import io
import json
from unittest import TestCase
from unittest.mock import MagicMock, patch
from PIL import Image
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import RequestFactory
from core import election_appearance as appearance


class FilingSlideshowTests(TestCase):
    def test_defaults_match_five_mobile_slides(self):
        slides = appearance.default_slides()
        self.assertEqual(len(slides), 5)
        self.assertEqual(slides[0]['title'], 'Lead the Change')
        self.assertEqual(slides[2]['title'], 'Ready to Serve?')
        self.assertTrue(all(slide['use_default_text'] for slide in slides))

    def test_custom_text_order_and_added_slide_are_preserved(self):
        slides = appearance.default_slides()[::-1]
        slides.append(dict(slides[0], id='added', use_default_text=False, title='My title', subtitle='My custom description'))
        result = appearance.validate_slide_draft(json.dumps(slides), [])
        self.assertEqual(result[0]['default_index'], 4)
        self.assertEqual(result[-1]['title'], 'My title')

    def test_provided_text_overrides_unsaved_custom_text(self):
        slide = dict(appearance.default_slides()[0], title='Ignored', subtitle='Ignored')
        result = appearance.validate_slide_draft(json.dumps([slide]), [])
        self.assertEqual(result[0]['title'], 'Lead the Change')

    def test_empty_too_many_duplicate_ids_and_long_text_rejected(self):
        defaults = appearance.default_slides()
        cases = [[], defaults * 3, [defaults[0], defaults[0]],
                 [dict(defaults[0], use_default_text=False, title='x' * 61)],
                 [dict(defaults[0], use_default_text=False, subtitle='')],
                 [dict(defaults[0], default_index=10)]]
        for slides in cases:
            with self.subTest(slides=slides):
                self.assertRaises(ValueError, appearance.validate_slide_draft, json.dumps(slides), [])

    def test_only_saved_image_urls_can_be_retained(self):
        url = 'https://res.cloudinary.com/demo/image/upload/saved.jpg'
        slide = dict(appearance.default_slides()[0], image_url=url)
        self.assertRaises(ValueError, appearance.validate_slide_draft, json.dumps([slide]), [])
        result = appearance.validate_slide_draft(json.dumps([slide]), [slide])
        self.assertEqual(result[0]['image_url'], url)

    def test_legacy_background_becomes_one_editable_slide(self):
        cursor = MagicMock()
        url = 'https://res.cloudinary.com/demo/image/upload/legacy.jpg'
        cursor.fetchone.return_value = (None, url)
        with patch.object(appearance.connection, 'cursor') as cur:
            cur.return_value.__enter__.return_value = cursor
            result = appearance.get_filing_slides(7)
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]['image_url'], url)
        self.assertEqual(cursor.execute.call_args.args[1], [7])

    def test_save_order_and_text_are_written_as_one_election_record(self):
        slides = appearance.default_slides()[::-1]
        request = RequestFactory().post('/api/admin/elections/7/appearance/', {'slides': json.dumps(slides)})
        cursor = MagicMock()
        with patch.object(appearance, 'get_filing_slides', return_value=appearance.default_slides()), patch.object(appearance.connection, 'cursor') as cur:
            cur.return_value.__enter__.return_value = cursor
            response = appearance.save_slide_draft(request, 7)
        self.assertEqual(response.status_code, 200)
        params = cursor.execute.call_args.args[1]
        self.assertEqual(params[0], 7)
        self.assertEqual(json.loads(params[3])[0]['default_index'], 4)

    def test_upload_failure_keeps_saved_slides_unchanged(self):
        slide = appearance.default_slides()[0]
        image = io.BytesIO(); Image.new('RGB', (800, 360), 'navy').save(image, format='PNG')
        upload = SimpleUploadedFile('card.png', image.getvalue(), content_type='image/png')
        request = RequestFactory().post('/', {'slides': json.dumps([slide]), 'image_default-0': upload})
        with patch.object(appearance, 'get_filing_slides', return_value=[]), patch.object(appearance, 'upload_image_bytes', side_effect=RuntimeError('unavailable')), patch.object(appearance.connection, 'cursor') as cur:
            response = appearance.save_slide_draft(request, 7)
        self.assertEqual(response.status_code, 503)
        cur.assert_not_called()

    def test_all_uploads_are_validated_before_sending_any_to_cloudinary(self):
        slide = appearance.default_slides()[0]
        upload = SimpleUploadedFile('fake.png', b'bad image', content_type='image/png')
        request = RequestFactory().post('/', {'slides': json.dumps([slide]), 'image_default-0': upload})
        with patch.object(appearance, 'get_filing_slides', return_value=[]), patch.object(appearance, 'upload_image_bytes') as sender:
            response = appearance.save_slide_draft(request, 7)
        self.assertEqual(response.status_code, 400)
        sender.assert_not_called()
