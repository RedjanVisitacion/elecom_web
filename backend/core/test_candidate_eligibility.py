import unittest
from unittest.mock import Mock
from core.candidate_eligibility import allowed_organizations, validate_student_eligibility

class EligibilityTests(unittest.TestCase):
    def test_department_mappings_keep_usg_available(self):
        for program,organization in [('BSIT','SITE'),('BTLED','PAFE'),('BFPT','AFPROTECHS')]:
            self.assertEqual(allowed_organizations(program),['USG',organization])

    def validate(self, saved='BSIT', **fields):
        cur=Mock();cur.fetchone.return_value=(saved,)
        payload=dict(student_id='test',program='BSIT',organization='SITE',position='President')
        payload.update(fields)
        return validate_student_eligibility(cur,payload)

    def test_correct_department_and_usg_allowed(self):
        self.assertEqual(self.validate(),'BSIT')
        self.assertEqual(self.validate(organization='USG',position='BSIT Representative'),'BSIT')

    def test_cross_department_and_program_spoof_blocked(self):
        for fields in [dict(organization='PAFE'),dict(program='BTLED',organization='PAFE'),dict(organization='USG',position='BFPT Representative'),dict(position='BSIT Representative')]:
            with self.subTest(fields=fields),self.assertRaises(ValueError):
                self.validate(**fields)

    def test_full_program_name_and_historical_afpro_alias(self):
        self.assertEqual(self.validate(saved='Bachelor of Science in Information Technology'),'BSIT')
        self.assertEqual(self.validate(saved='BFPT',program='BFPT',organization='AFPRO'),'BFPT')

    def test_missing_profile_program_requires_account_correction(self):
        with self.assertRaises(ValueError):
            self.validate(saved='')
