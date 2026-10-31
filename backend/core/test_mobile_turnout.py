"""Exercise the mobile endpoint against archived/current ballots without Django startup."""
import ast
from datetime import datetime, timezone
from pathlib import Path
import sqlite3
from types import SimpleNamespace
import unittest
from unittest.mock import Mock


class MobileTurnoutTests(unittest.TestCase):
    def setUp(self):
        tree = ast.parse(Path(__file__).with_name('views.py').read_text(encoding='utf-8'))
        names = {'election_window_api', '_current_vote_filter', '_current_election_filter'}
        nodes = [node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name in names]
        for node in nodes:
            node.decorator_list = []
        self.db = sqlite3.connect(':memory:')
        self.addCleanup(self.db.close)
        self.db.executescript('''
            CREATE TABLE vote_windows (id INTEGER, start_at TEXT, end_at TEXT, results_at TEXT);
            INSERT INTO vote_windows VALUES (1, NULL, NULL, NULL), (2, NULL, NULL, NULL);
            CREATE TABLE users (role TEXT);
            INSERT INTO users VALUES ('student'), ('student'), ('student');
            CREATE TABLE candidates_registration (election_id INTEGER);
            INSERT INTO candidates_registration VALUES (1);
            CREATE TABLE votes (election_id INTEGER, student_id TEXT);
            INSERT INTO votes VALUES (1, 'old'), (NULL, 'legacy');
        ''')
        db = self.db
        class Cursor:
            def __enter__(self):
                self.cursor = db.cursor()
                return self
            def __exit__(self, *args):
                self.cursor.close()
            def execute(self, sql, params=None):
                self.cursor.execute(sql.replace('%s', '?'), params or [])
            def fetchone(self):
                return self.cursor.fetchone()
        self.ns = dict(
            connection=SimpleNamespace(cursor=Cursor),
            _active_election_id=lambda: 2,
            _mark_student_account_seen=Mock(),
            _ensure_user_notifications_table=Mock(),
            _maybe_emit_election_broadcast_notifications=Mock(),
            _iso_or_none=lambda value: value,
            _vote_window_schedule_sig=Mock(return_value='schedule'),
            _compute_election_phases=Mock(return_value=('active', 'pending')),
            timezone=SimpleNamespace(now=lambda: datetime.now(timezone.utc)),
            JsonResponse=lambda data, **kwargs: data,
        )
        exec(compile(ast.Module(body=nodes, type_ignores=[]), '<mobile turnout>', 'exec'), self.ns)

    def metrics(self):
        return self.ns['election_window_api'](SimpleNamespace(session={'student_id': 'test'}))['metrics']

    def test_new_election_excludes_archived_and_legacy_votes(self):
        self.assertEqual(self.metrics()['total_cast_votes'], 0)
        self.assertEqual(self.metrics()['total_voters'], 3)

    def test_counts_only_current_ballots(self):
        self.db.execute("INSERT INTO votes VALUES (2, 'current')")
        self.assertEqual(self.metrics()['total_cast_votes'], 1)

    def test_legacy_only_database_matches_admin_compatibility(self):
        self.db.execute('DELETE FROM candidates_registration')
        self.assertEqual(self.metrics()['total_cast_votes'], 1)


if __name__ == '__main__':
    unittest.main()
