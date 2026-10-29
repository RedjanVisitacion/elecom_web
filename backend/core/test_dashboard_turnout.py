import ast
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import MagicMock, Mock

from core.dashboard_turnout import load_dashboard_turnout, load_dashboard_participation
from core.dashboard_activity import load_dashboard_activity


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

    def test_closed_election_uses_full_schedule_including_partial_hours(self):
        election = {"status": "Closed", "start_at": "2026-10-04T08:30:00+08:00",
                    "end_at": "2026-10-05T17:15:00+08:00"}
        self.cursor.fetchall.return_value = [(datetime(2026, 10, 4, 8), 5),
                                               (datetime(2026, 10, 5, 17), 3)]
        result = load_dashboard_turnout(self.connection, "v.election_id = %s", [7], self.now, election)
        sql, params = self.cursor.execute.call_args.args
        self.assertEqual(params[0], 7)
        self.assertEqual(params[1].isoformat(), election["start_at"])
        self.assertEqual(params[2].isoformat(), election["end_at"])
        self.assertEqual(result["scope"], "historical")
        self.assertEqual(len(result["hourly"]), 34)
        self.assertEqual(result["hourly"][0]["count"], 5)
        self.assertEqual(result["hourly"][-1]["hour"], "2026-10-05T17:00:00+08:00")
        self.assertIsNone(result["hourly"][-1]["count"])
        self.assertTrue(result["hourly"][-1]["withheld"])

    def test_active_election_keeps_latest_24_completed_hours(self):
        result = load_dashboard_turnout(self.connection, "TRUE", [], self.now, {"status": "Active"})
        self.assertEqual(result["scope"], "latest_24_hours")
        self.assertEqual(len(result["hourly"]), 24)
        self.assertEqual(result["hourly"][-1]["hour"], "2026-10-07T14:00:00+08:00")

    def test_historical_hour_boundary_excludes_hour_after_end(self):
        for status in ("Closed", "Finished", "Completed"):
            with self.subTest(status=status):
                result = load_dashboard_turnout(self.connection, "TRUE", [], self.now, {
                    "status": status, "start_at": "2026-10-04T08:00:00+08:00",
                    "end_at": "2026-10-05T17:00:00+08:00"})
                self.assertEqual(len(result["hourly"]), 33)
                self.assertEqual(result["hourly"][-1]["hour"], "2026-10-05T16:00:00+08:00")

    def api(self, role="admin", election_row=None, participation_failure=False):
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
            "_iso_or_none": lambda value: value.isoformat() if value else None,
            "_compute_election_phases": lambda **kwargs: ("closed", None),
            "load_dashboard_turnout": load_dashboard_turnout,
            "load_dashboard_participation": Mock(side_effect=RuntimeError("totals unavailable") if participation_failure else None, return_value={"total_voters": 1647, "total_cast_votes": 2}),
            "load_dashboard_activity": load_dashboard_activity,
            "JsonResponse": Response, "logger": Mock(),
        }
        self.cursor.fetchone.side_effect = [(35,), (1647,), (2,), election_row]
        exec(compile(ast.Module(body=[function], type_ignores=[]), "<dashboard api>", "exec"), namespace)
        return namespace["admin_dashboard_api"](SimpleNamespace(session={"role": role}))

    def test_api_exports_only_aggregate_activity(self):
        response = self.api()
        self.assertTrue(response.data["ok"])
        self.assertEqual(set(response.data), {"ok", "metrics", "election", "participation", "turnout", "activity"})
        self.assertEqual(response["Cache-Control"], "no-store")
        self.assertEqual(response.data["metrics"]["total_cast_votes"], 2)
        for token in ("student_id", "first_name", "last_name", "voted_at", "vote_items"):
            self.assertNotIn(token, str(response.data))
            self.assertNotIn(token, " ".join(call.args[0] for call in self.cursor.execute.call_args_list))

    def test_api_passes_closed_schedule_to_turnout_query(self):
        response = self.api(election_row=(
            datetime(2026, 10, 4, 0, tzinfo=timezone.utc),
            datetime(2026, 10, 5, 9, tzinfo=timezone.utc), None))
        self.assertEqual(response.data["election"]["status"], "Closed")
        self.assertEqual(response.data["turnout"]["scope"], "historical")
        self.assertEqual(len(response.data["turnout"]["hourly"]), 33)

    def test_api_fails_closed_when_hourly_query_fails(self):
        self.cursor.fetchall.side_effect = RuntimeError("database unavailable")
        response = self.api()
        self.assertTrue(response.data["ok"])
        self.assertIsNone(response.data["turnout"])
        self.assertNotIn("recent_votes", response.data)

    def test_api_participation_failure_keeps_other_metrics_and_hourly_data(self):
        response = self.api(participation_failure=True)
        self.assertIsNone(response.data["participation"])
        self.assertEqual(response.data["metrics"]["total_cast_votes"], 2)
        self.assertIsNotNone(response.data["turnout"])

    def test_api_rejects_non_admin(self):
        response = self.api("student")
        self.assertEqual(response.status_code, 403)
        self.connection.cursor.assert_not_called()


class DashboardParticipationTests(unittest.TestCase):
    def setUp(self):
        self.connection = MagicMock()
        self.cursor = self.connection.cursor.return_value.__enter__.return_value

    def test_distinct_submitters_keep_election_scope_and_student_denominator(self):
        self.cursor.fetchone.return_value = (1643, 31)
        result = load_dashboard_participation(self.connection, "v.election_id = %s", [7])
        sql, params = self.cursor.execute.call_args.args
        self.assertIn("COUNT(DISTINCT v.student_id)", sql)
        self.assertIn("v.election_id = %s", sql)
        self.assertEqual(params, ["student", 7])
        self.assertEqual(result, {"total_voters": 1643, "total_cast_votes": 31})
        self.assertEqual(set(result), {"total_voters", "total_cast_votes"})

    def test_no_registered_voters_returns_real_zero_counts(self):
        self.cursor.fetchone.return_value = (0, 0)
        self.assertEqual(load_dashboard_participation(self.connection, "TRUE", []), {"total_voters": 0, "total_cast_votes": 0})

    def test_database_failure_is_not_reported_as_zero_turnout(self):
        self.cursor.execute.side_effect = RuntimeError("database unavailable")
        with self.assertRaises(RuntimeError):
            load_dashboard_participation(self.connection, "TRUE", [])


    def test_duplicate_ballots_and_other_elections_do_not_inflate_participation(self):
        import sqlite3
        from contextlib import contextmanager
        database = sqlite3.connect(":memory:")
        self.addCleanup(database.close)
        database.executescript("""
            CREATE TABLE users (role TEXT);
            INSERT INTO users VALUES ('student'), ('student'), ('student'), ('admin');
            CREATE TABLE votes (student_id TEXT, election_id INTEGER);
            INSERT INTO votes VALUES ('S1', 7), ('S1', 7), ('S2', 7), ('S3', 8);
        """)
        class Connection:
            @contextmanager
            def cursor(self):
                class Cursor:
                    def execute(self, sql, params):
                        self.cursor = database.execute(sql.replace("%s", "?"), params)
                    def fetchone(self):
                        return self.cursor.fetchone()
                yield Cursor()
        result = load_dashboard_participation(Connection(), "v.election_id = %s", [7])
        self.assertEqual(result, {"total_voters": 3, "total_cast_votes": 2})
