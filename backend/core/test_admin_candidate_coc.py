import base64
import io
from pathlib import Path
import unittest
from unittest.mock import Mock, patch
from django.conf import settings
if not settings.configured:
    settings.configure(BASE_DIR=Path(__file__).resolve().parents[1], USE_TZ=True)
from PIL import Image, ImageDraw
from pypdf import PdfReader
from core.admin_candidate_coc import build_certificate, archive_direct_registration


def png(signed=False):
    image=Image.new('RGB',(180,60),'white')
    if signed:
        ImageDraw.Draw(image).line([(10,45),(50,10),(75,40),(140,20)],fill='black',width=3)
    output=io.BytesIO();image.save(output,format='PNG')
    return base64.b64encode(output.getvalue()).decode()


class AdminCocTests(unittest.TestCase):
    def payload(self, organization='USG'):
        return dict(student_id='test-123', first_name='Test', last_name='Candidate', organization=organization,
                    position='President', program='BSIT',year_section='BSIT-1A',gender='Female',
                    date_of_birth='2005-01-02',contact_number='test-contact',email='test@example.invalid',
                    address='Test address',candidate_type='Independent',signature_base64=png(True),photo_base64=png())

    def test_both_mobile_template_sizes_and_candidate_fields(self):
        for organization,height in [('USG',1008),('SITE',792)]:
            with self.subTest(organization=organization):
                certificate=build_certificate(self.payload(organization))
                reader=PdfReader(io.BytesIO(certificate['pdf']))
                self.assertEqual(len(reader.pages),1)
                self.assertEqual(float(reader.pages[0].mediabox.height),height)
                self.assertIn('Test Candidate',reader.pages[0].extract_text())
                self.assertIn('test-123',reader.pages[0].extract_text())
                self.assertNotIn('signature_base64',certificate['fields'])

    def test_blank_signature_rejected(self):
        payload=self.payload();payload['signature_base64']=png()
        with self.assertRaisesRegex(ValueError,'signature'):
            build_certificate(payload)

    def test_missing_contact_and_future_birth_rejected(self):
        for key,value in [('email',''),('date_of_birth','2200-01-01'),('photo_base64','invalid')]:
            payload=self.payload();payload[key]=value
            with self.subTest(key=key), self.assertRaises(ValueError):
                build_certificate(payload)

    def test_direct_archive_is_approved_and_issues_both_editions(self):
        cur=Mock();cur.fetchone.side_effect=[None,(42,)]
        payload=self.payload();certificate={'pdf':b'pdf'}
        with patch('core.candidate_certificates.save_certificate') as save, patch('core.coc_management.issue_certificate') as issue, patch('core.coc_chairperson_signatures.finalize_certificate') as finalize:
            self.assertEqual(archive_direct_registration(cur,payload,7,'admin',certificate),42)
            self.assertIn("'approved'",cur.execute.call_args.args[0])
            save.assert_called_once();issue.assert_called_once();finalize.assert_called_once()
            self.assertEqual(issue.call_args.args[1]['election_id'],7)

    def test_existing_filing_keeps_original_archive(self):
        cur=Mock();cur.fetchone.return_value=(12,)
        with self.assertRaisesRegex(ValueError,'already has a filing'):
            archive_direct_registration(cur,self.payload(),7,'admin',{})
        self.assertEqual(cur.execute.call_count,1)
