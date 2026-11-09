from unittest.mock import MagicMock, patch

from unittest import TestCase
from django.test import RequestFactory

from core import views


class ReportOrganizationTests(TestCase):
    def request_summary(self, organization='', scope='election'):
        cursor = MagicMock()
        cursor.fetchone.return_value = (0,)
        cursor.fetchall.return_value = []
        cursor.description = []
        with patch.multiple(
            views,
            _require_admin=lambda request: None,
            _ensure_votes_tables=lambda: None,
            _ensure_election_scoped_tables=lambda: None,
            _parse_election_id_from_request=lambda *args: 7,
            _active_election_id=lambda: 7,
            _admin_results_release_gate=lambda election_id: None,
            _current_vote_filter=lambda *args: ('v.election_id = %s', [7]),
            _current_election_filter=lambda *args: ('c.election_id = %s', [7]),
        ), patch.object(views.connection, 'cursor') as connection_cursor:
            connection_cursor.return_value.__enter__.return_value = cursor
            response = views.admin_reports_summary_api(RequestFactory().get(
                '/api/admin/reports/summary/',
                {'organization': organization, 'election_id': '7', 'scope': scope},
            ))
        return response, cursor

    def test_each_organization_filters_ballots_candidates_and_eligible_voters(self):
        for organization in ['USG', 'SITE', 'PAFE', 'AFPROTECHS', 'AFPRO']:
            with self.subTest(organization=organization):
                response, cursor = self.request_summary(organization)
                self.assertEqual(response.status_code, 200)
                canonical = 'AFPROTECHS' if organization == 'AFPRO' else organization
                calls = cursor.execute.call_args_list
                self.assertIn('EXISTS', calls[0].args[0])
                self.assertEqual(calls[0].args[1][-1], canonical)
                self.assertEqual(calls[-1].args[1][-1], canonical)
                self.assertEqual('department' in calls[2].args[0], canonical != 'USG')

    def test_all_organizations_preserves_unfiltered_ballots(self):
        response, cursor = self.request_summary()
        self.assertEqual(response.status_code, 200)
        self.assertNotIn('EXISTS', cursor.execute.call_args_list[0].args[0])

    def test_all_elections_does_not_limit_candidates_to_active_election(self):
        response, cursor = self.request_summary('SITE', 'all')
        self.assertEqual(response.status_code, 200)
        self.assertNotIn('c.election_id = %s', cursor.execute.call_args_list[-1].args[0])
        self.assertEqual(cursor.execute.call_args_list[-1].args[1], ['SITE'])

    def test_invalid_organization_rejected_without_queries(self):
        response, cursor = self.request_summary('INVALID')
        self.assertEqual(response.status_code, 400)
        cursor.execute.assert_not_called()
