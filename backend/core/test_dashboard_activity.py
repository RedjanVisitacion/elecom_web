import unittest
from datetime import datetime, timezone
from unittest.mock import MagicMock
from core.dashboard_activity import load_dashboard_activity

class DashboardActivityTests(unittest.TestCase):
    def setUp(self):
        self.db = MagicMock()
        self.cursor = self.db.cursor.return_value.__enter__.return_value

    def test_chronological_sort_no_identities(self):
        self.cursor.fetchall.side_effect = [[(datetime(2026, 10, 11, 3, tzinfo=timezone.utc),)], [(datetime(2026, 10, 11, 4, tzinfo=timezone.utc),)]]
        result = load_dashboard_activity(self.db, [{"period_start": "2026-10-11T10:00:00+08:00", "count": 5}])
        self.assertTrue(result["complete"])
        self.assertEqual([e["kind"] for e in result["events"]], ["network", "biometric", "vote"])
        for query in self.cursor.execute.call_args_list:
            self.assertNotIn("student_id", query.args[0])
        self.assertNotIn("student_id", str(result))

    def test_missing_source_retains_available_events(self):
        self.cursor.fetchall.side_effect = [RuntimeError("missing table"), [(datetime(2026, 10, 11, 4),)]]
        result = load_dashboard_activity(self.db, [])
        self.assertFalse(result["complete"])
        self.assertEqual(result["events"][0]["kind"], "network")
        self.assertTrue(result["events"][0]["timestamp"].endswith("+00:00"))

    def test_empty_sources(self):
        self.cursor.fetchall.return_value = []
        self.assertEqual(load_dashboard_activity(self.db, []), {"events": [], "complete": True})
