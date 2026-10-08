"""Isolated push tests, without Django/face-service/FCM credentials."""
import ast
from contextlib import nullcontext
from datetime import datetime, timedelta
from pathlib import Path
from types import SimpleNamespace
import json
import unittest

source = Path(__file__).with_name("candidate_push.py").read_text()
nodes = [node for node in ast.parse(source).body if isinstance(node, ast.FunctionDef)]
for node in nodes:
    node.decorator_list = []
ns = {"json": json, "timedelta": timedelta}
exec(compile(ast.Module(body=nodes, type_ignores=[]), "<candidate push>", "exec"), ns)


class Cursor:
    def __init__(self, row=None, tokens=()):
        self.row = row
        self.tokens = tokens
        self.queries = []
    def __enter__(self): return self
    def __exit__(self, *args): pass
    def execute(self, sql, params=None): self.queries.append((sql, params))
    def fetchone(self): return self.row
    def fetchall(self): return [(token,) for token in self.tokens]


class PushTests(unittest.TestCase):
    def setUp(self):
        self.cursor = Cursor()
        self.commits = []
        ns.update(
            connection=SimpleNamespace(cursor=lambda: self.cursor),
            transaction=SimpleNamespace(atomic=nullcontext, on_commit=self.commits.append),
            JsonResponse=lambda data, status=200: SimpleNamespace(data=data, status_code=status),
            timezone=SimpleNamespace(now=lambda: datetime(2026, 10, 7)),
        )

    def request(self, student="student", token="device"):
        return SimpleNamespace(session={"student_id": student}, body=json.dumps({"token": token}).encode())

    def test_auto_creation_matches_migration_and_can_be_repeated(self):
        ns["ensure_candidate_push_tables"]()
        ns["ensure_candidate_push_tables"]()
        sql = self.cursor.queries[0][0]
        self.assertEqual(sql, self.cursor.queries[1][0])
        migration = Path(__file__).parents[1] / "elecom_voting" / "migrations" / "0017_candidate_push_notifications.py"
        tree = ast.parse(migration.read_text())
        migration_sql = next(
            kw.value.value for node in ast.walk(tree) if isinstance(node, ast.Call)
            for kw in node.keywords if kw.arg == "sql"
        )
        self.assertEqual(" ".join(sql.split()), " ".join(migration_sql.split()))
        self.assertNotIn("DROP TABLE", sql)
        self.assertEqual(sql.count("CREATE TABLE IF NOT EXISTS"), 2)
        self.assertEqual(sql.count("CREATE INDEX IF NOT EXISTS"), 2)

    def test_register_requires_authenticated_account(self):
        result = ns["register_push_token_api"](self.request(student=""))
        self.assertEqual(result.status_code, 401)
        self.assertEqual(self.cursor.queries, [])

    def test_registration_uses_session_account_not_client_identity(self):
        result = ns["register_push_token_api"](self.request())
        self.assertEqual(result.status_code, 200)
        sql, params = self.cursor.queries[0]
        self.assertIn("ON CONFLICT", sql)
        self.assertEqual(params, ["device", "student"])

    def test_unregistration_cannot_remove_another_accounts_token(self):
        ns["unregister_push_token_api"](self.request())
        sql, params = self.cursor.queries[0]
        self.assertIn("student_id = %s", sql)
        self.assertEqual(params, ["device", "student"])

    def test_invalid_token_is_rejected(self):
        for token in (None, "", "x" * 4097, []):
            self.assertEqual(ns["register_push_token_api"](self.request(token=token)).status_code, 400)

    def test_push_is_queued_and_deferred_until_filing_commit(self):
        called = []
        ns["_try_delivery"] = called.append
        ns["queue_candidate_push"](notification_id=12, student_id="student", title="Approved", body="Body")
        self.assertEqual(called, [])
        self.assertEqual(self.cursor.queries[0][1], [12, "student", "Approved", "Body"])
        self.commits[0]()
        self.assertEqual(called, [12])

    def test_retry_only_sends_to_devices_not_already_delivered(self):
        self.cursor.row = ("student", "Approved", "Body", ["old"])
        self.cursor.tokens = ["old", "new"]
        messages = []
        def send(message):
            messages.append(message)
            return SimpleNamespace(responses=[SimpleNamespace(success=True)])
        ns["_messaging"] = lambda: SimpleNamespace(
            MulticastMessage=lambda **kwargs: kwargs,
            AndroidConfig=lambda **kwargs: kwargs,
            send_each_for_multicast=send,
        )
        self.assertTrue(ns["deliver_candidate_push"](12))
        self.assertEqual(messages[0]["tokens"], ["new"])
        self.assertEqual(messages[0]["data"]["notification_id"], "12")
        self.assertEqual(messages[0]["data"]["student_id"], "student")
        self.assertNotIn("notification", messages[0])
        self.assertEqual(messages[0]["android"]["priority"], "high")

    def test_invalid_tokens_removed_and_transient_failures_retained(self):
        class UnregisteredError(Exception): pass
        self.cursor.row = ("student", "Approved", "Body", [])
        self.cursor.tokens = ["invalid", "retry"]
        ns["_messaging"] = lambda: SimpleNamespace(
            MulticastMessage=lambda **kwargs: kwargs,
            AndroidConfig=lambda **kwargs: kwargs,
            UnregisteredError=UnregisteredError,
            send_each_for_multicast=lambda _: SimpleNamespace(responses=[
                SimpleNamespace(success=False, exception=UnregisteredError()),
                SimpleNamespace(success=False, exception=Exception("temporary")),
            ]),
        )
        self.assertFalse(ns["deliver_candidate_push"](12))
        self.assertTrue(any("DELETE FROM mobile_push_tokens" in sql and params == ["invalid", "student"]
                            for sql, params in self.cursor.queries))
        self.assertIsNone(self.cursor.queries[-1][1][1])


if __name__ == "__main__":
    unittest.main()
