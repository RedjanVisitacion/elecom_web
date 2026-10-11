import unittest
from unittest.mock import Mock
from core.candidate_parties import party_key, lock_party, party_rows, canonical_logo, share_logo


class CandidatePartyTests(unittest.TestCase):
    def test_identity_normalization_and_independent(self):
        self.assertEqual(party_key('  UNITE '), 'unite')
        self.assertEqual(party_key('Independent'), '')

    def test_lock_is_stable_and_election_scoped(self):
        cur = Mock()
        lock_party(cur, 1, 'UNITE')
        first = cur.execute.call_args
        lock_party(cur, 1, ' unite ')
        self.assertEqual(first, cur.execute.call_args)
        lock_party(cur, 2, 'UNITE')
        self.assertNotEqual(first, cur.execute.call_args)

    def test_pending_and_registered_share_identity(self):
        cur = Mock()
        cur.fetchall.return_value = [('UNITE', 'hash', 'code', 'logo')]
        self.assertEqual(party_rows(cur, 3, ' unite '), cur.fetchall.return_value)
        sql, params = cur.execute.call_args.args
        self.assertIn('candidate_applications', sql)
        self.assertIn('candidates_registration', sql)
        self.assertEqual(params, [3, 'unite', 3, 'unite'])

    def test_new_member_cannot_override_canonical_logo(self):
        cur = Mock()
        cur.fetchall.return_value = [('UNITE', None, None, ''), ('UNITE', None, None, 'shared')]
        self.assertEqual(canonical_logo(cur, 3, 'UNITE', 'different'), 'shared')

    def test_new_party_uses_proposed_logo(self):
        cur = Mock()
        cur.fetchall.return_value = []
        self.assertEqual(canonical_logo(cur, 3, 'NEW', 'new-logo'), 'new-logo')

    def test_logo_update_stays_in_election_and_party(self):
        cur = Mock(rowcount=2)
        self.assertEqual(share_logo(cur, 3, ' unite ', 'new-logo'), 4)
        self.assertEqual(cur.execute.call_count, 2)
        for call in cur.execute.call_args_list:
            self.assertEqual(call.args[1], ['new-logo', 3, 'unite', 'new-logo'])

    def test_independents_never_share_logo_or_lock(self):
        cur = Mock()
        self.assertEqual(share_logo(cur, 3, 'Independent', 'logo'), 0)
        lock_party(cur, 3, 'Independent')
        self.assertEqual(party_rows(cur, 3, 'Independent'), [])
        cur.execute.assert_not_called()


if __name__ == '__main__':
    unittest.main()
