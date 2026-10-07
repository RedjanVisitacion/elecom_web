"""Isolated API release tests without biometric dependencies or a live database."""
import ast
from datetime import datetime, timedelta, timezone
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import MagicMock


class ResultsReleaseTests(unittest.TestCase):
    def setUp(self):
        self.now = datetime(2026, 10, 7, 12, tzinfo=timezone.utc)
        self.connection = MagicMock()
        self.cursor = self.connection.cursor.return_value.__enter__.return_value
        self.environment = {
            "connection": self.connection,
            "timezone": SimpleNamespace(now=lambda: self.now),
            "_vote_window_times_aware": lambda *values: values,
            "JsonResponse": lambda data, **kwargs: dict(data, status=kwargs.get("status", 200)),
            "_require_admin": lambda request: None,
            "_ensure_votes_tables": lambda: None,
            "_parse_election_id_from_request": lambda *args: 7,
            "_active_election_id": lambda: 7,
        }
        tree = ast.parse(Path(__file__).with_name("views.py").read_text(encoding="utf-8"))
        functions = [node for node in tree.body if isinstance(node, ast.FunctionDef)
                     and node.name in {"_admin_results_release_gate", "admin_results_api", "_party_position_limit"}]
        for node in functions:
            node.decorator_list = []
        exec(compile(ast.Module(body=functions, type_ignores=[]), "views.py", "exec"), self.environment)

    def gate(self, end, release):
        self.cursor.fetchone.return_value = (7, self.now - timedelta(days=1), end, release)
        return self.environment["_admin_results_release_gate"](7)

    def test_future_release_blocks_tallies(self):
        response = self.gate(self.now - timedelta(hours=1), self.now + timedelta(hours=1))
        self.assertFalse(response["published"])
        self.assertNotIn("grouped", response)
        self.assertEqual(response["Cache-Control"], "no-store, private")

    def test_release_boundary_opens_after_close(self):
        self.assertIsNone(self.gate(self.now - timedelta(seconds=1), self.now))

    def test_voting_still_open_even_if_release_is_misconfigured(self):
        self.assertFalse(self.gate(self.now, self.now)["published"])
        self.assertFalse(self.gate(self.now + timedelta(hours=1), self.now)["published"])

    def test_unscheduled_or_missing_election_is_locked(self):
        self.assertFalse(self.gate(self.now - timedelta(hours=1), None)["published"])
        self.cursor.fetchone.return_value = None
        self.assertFalse(self.environment["_admin_results_release_gate"](999)["published"])

    def test_database_failure_fails_closed(self):
        self.cursor.execute.side_effect = RuntimeError("offline")
        self.assertEqual(self.environment["_admin_results_release_gate"](7)["status"], 503)

    def test_admin_api_never_queries_tallies_when_locked(self):
        self.cursor.fetchone.return_value = (7, self.now, self.now + timedelta(hours=1), self.now + timedelta(hours=2))
        response = self.environment["admin_results_api"](SimpleNamespace(GET={}))
        self.assertFalse(response["published"])
        self.assertEqual(self.cursor.execute.call_count, 1)
        self.assertNotIn("vote_items", self.cursor.execute.call_args.args[0])

    def published_result(self, organization="USG", position="BSIT Representative", ballot_count=1):
        self.cursor.fetchone.side_effect = [
            (7, self.now - timedelta(days=1), self.now - timedelta(seconds=1), self.now),
            (ballot_count,),
        ]
        self.cursor.fetchall.side_effect = [
            [(organization, position.upper(), ballot_count)],
            [(1, "One", organization, position, "UNITE", 1),
             (2, "Two", organization, position, "UNITE", 1),
             (3, "Three", organization, position, "OTHER", 0)],
        ]
        self.cursor.description = [(name,) for name in ("id", "first_name", "organization", "position", "party_name", "votes")]
        self.environment.update({
            "_current_election_filter": lambda *args: ("c.election_id = %s", [7]),
            "_current_vote_filter": lambda *args: ("v.election_id = %s", [7]),
            "identity_row": lambda cols, row: dict(zip(cols, row)),
        })
        return self.environment["admin_results_api"](SimpleNamespace(GET={}))

    def test_two_running_mates_selected_on_one_ballot_both_have_full_support(self):
        data = self.published_result()
        position = next(group for group in data["grouped"] if group["party_name"] == "UNITE")["organizations"][0]["positions"][0]
        self.assertEqual(position["seats"], 2)
        self.assertEqual(position["max_votes"], 2)
        self.assertEqual(position["ballots_cast"], 1)
        self.assertEqual([c["percent_in_position"] for c in position["candidates"]], [100.0, 100.0])
        other = next(group for group in data["grouped"] if group["party_name"] == "OTHER")["organizations"][0]["positions"][0]
        self.assertEqual(other["ballots_cast"], 1)
        sql, params = self.cursor.execute.call_args_list[2].args
        self.assertIn("COUNT(DISTINCT v.id)", sql)
        self.assertIn("v.election_id = %s", sql)
        self.assertIn("c.election_id = %s", sql)
        self.assertNotIn("party_name", sql)
        self.assertEqual(params, [7, 7])

    def test_multi_seat_support_uses_ballots_not_candidate_sum(self):
        data = self.published_result(ballot_count=4)
        position = next(group for group in data["grouped"] if group["party_name"] == "UNITE")["organizations"][0]["positions"][0]
        self.assertEqual([c["percent_in_position"] for c in position["candidates"]], [25.0, 25.0])

    def test_capacity_matches_existing_ballot_rules(self):
        capacity = self.environment["_party_position_limit"]
        self.assertEqual(capacity("USG", "BSIT Representative"), 2)
        self.assertEqual(capacity("USG", "BTLED Representative"), 2)
        self.assertEqual(capacity("USG", "BFPT Representative"), 2)
        self.assertEqual(capacity("USG", "President"), 1)
        self.assertEqual(capacity("PAFE", "President"), 1)


if __name__ == "__main__":
    unittest.main()
