import ast
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import MagicMock, Mock

from core.dashboard_turnout import load_dashboard_turnout


class DashboardTurnoutTests(unittest.TestCase):
    def setUp(self):
        self.now = datetime(2026, 10, 7, 7, 47, tzinfo=timezone.utc)
        self.connection = MagicMock()
        self.cursor = self.connection.cursor.return_value.__enter__.return_value
        self.cursor.fetchall.return_value = []

    def load(self):
        return load_dashboard_turnout(self.connection, "v.election_id = %s", [7], self.now)

    def test_completed_hours_only_and_election_scope(self):
        result = self.load()
        sql, params = self.cursor.execute.call_args.args
        self.assertIn("v.election_id = %s", sql)
        self.assertIn("v.created_at < %s", sql)
        self.assertIn("GROUP BY 1", sql)
        self.assertNotIn("student_id", sql)
        self.assertNotIn("vote_items", sql)
        self.assertEqual(params[0], 7)
        self.assertEqual(params[2].isoformat(), "2026-10-07T15:00:00+08:00")
        self.assertEqual(len(result["hourly"]), 24)
        self.assertEqual(result["hourly"][-1]["hour"], "2026-10-07T14:00:00+08:00")

    def test_small_counts_are_withheld_and_never_become_activity(self):
        for count in range(1, 5):
            with self.subTest(count=count):
                self.cursor.fetchall.return_value = [(datetime(2026, 10, 7, 14), count)]
                result = self.load()
                self.assertEqual(result["hourly"][-1]["count"], None)
                self.assertTrue(result["hourly"][-1]["withheld"])
                self.assertEqual(result["activity"], [])

    def test_publishable_activity_is_coarse_and_limited(self):
        self.cursor.fetchall.return_value = [(datetime(2026, 10, 7, hour), 5) for hour in range(7, 15)]
        result = self.load()
        self.assertEqual(len(result["activity"]), 6)
        self.assertEqual(result["activity"][0], {"period_start": "2026-10-07T14:00:00+08:00", "count": 5})
        for item in result["activity"]:
            self.assertEqual(set(item), {"period_start", "count"})

    def test_empty_hours_are_zero_instead_of_withheld(self):
        result = self.load()
        self.assertTrue(all(item["count"] == 0 and not item["withheld"] for item in result["hourly"]))
        self.assertEqual(result["activity"], [])

    def api(self, role="admin"):
        module = ast.parse(Path(__file__).with_name("views.py").read_text(encoding="utf-8-sig"))
        function = next(node for node in module.body if isinstance(node, ast.FunctionDef) and node.name == "admin_dashboard_api")
        function.decorator_list = []

        class Response(dict):
            def __init__(self, data, status=200):
                self.data = data
                self.status_code = status

        namespace = {
            "connection": self.connection,
            "_ensure_auth_identity_tables": Mock(), "_ensure_votes_tables": Mock(),
            "_current_election_filter": lambda: ("election_id = %s", [7]),
            "_current_vote_filter": lambda alias="": (f"{alias + '.' if alias else ''}election_id = %s", [7]),
            "timezone": SimpleNamespace(now=lambda: self.now),
            "load_dashboard_turnout": load_dashboard_turnout,
            "JsonResponse": Response, "logger": Mock(),
        }
        self.cursor.fetchone.side_effect = [(35,), (1647,), (2,), None]
        exec(compile(ast.Module(body=[function], type_ignores=[]), "<dashboard api>", "exec"), namespace)
        return namespace["admin_dashboard_api"](SimpleNamespace(session={"role": role}))

    def test_api_exports_only_aggregate_activity(self):
        response = self.api()
        self.assertTrue(response.data["ok"])
        self.assertEqual(set(response.data), {"ok", "metrics", "election", "turnout"})
        self.assertEqual(response["Cache-Control"], "no-store")
        self.assertEqual(response.data["metrics"]["total_cast_votes"], 2)
        for token in ("student_id", "first_name", "last_name", "voted_at", "vote_items"):
            self.assertNotIn(token, str(response.data))
            self.assertNotIn(token, " ".join(call.args[0] for call in self.cursor.execute.call_args_list))

    def test_api_fails_closed_when_hourly_query_fails(self):
        self.cursor.fetchall.side_effect = RuntimeError("database unavailable")
        response = self.api()
        self.assertTrue(response.data["ok"])
        self.assertIsNone(response.data["turnout"])
        self.assertNotIn("recent_votes", response.data)

    def test_api_rejects_non_admin(self):
        response = self.api("student")
        self.assertEqual(response.status_code, 403)
        self.connection.cursor.assert_not_called()
