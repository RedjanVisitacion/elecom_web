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
                     and node.name in {"_admin_results_release_gate", "admin_results_api"}]
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


if __name__ == "__main__":
    unittest.main()
