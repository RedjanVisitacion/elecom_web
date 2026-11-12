"""Regression coverage for mobile results using archived and current ballots."""
import ast
from datetime import datetime, timedelta
from pathlib import Path
import sqlite3
from types import SimpleNamespace
import unittest
from unittest.mock import Mock


class ResultsAnalyticsTests(unittest.TestCase):
    def setUp(self):
        source = Path(__file__).with_name('views.py').read_text(encoding='utf-8')
        names = {'results_analytics_api', '_current_vote_filter', '_current_election_filter'}
        nodes = [n for n in ast.parse(source).body if isinstance(n, ast.FunctionDef) and n.name in names]
        for node in nodes:
            node.decorator_list = []
        self.db = sqlite3.connect(':memory:')
        self.addCleanup(self.db.close)
        self.db.executescript('''
            CREATE TABLE vote_windows (id INTEGER);
            INSERT INTO vote_windows VALUES (1), (2);
            CREATE TABLE users (student_id TEXT, role TEXT, department TEXT);
            INSERT INTO users VALUES ('a', 'student', 'BSIT'), ('b', 'student', 'BTLED'),
                ('c', 'student', 'BFPT'), ('d', 'student', 'BSIT'), ('admin', 'admin', '');
            CREATE TABLE student (id INTEGER);
            INSERT INTO student VALUES (1), (2), (3), (4), (5), (6);
            CREATE TABLE candidates_registration (election_id INTEGER, position TEXT);
            INSERT INTO candidates_registration VALUES (1, 'Archived'), (2, 'President'), (2, 'Secretary');
            CREATE TABLE votes (id INTEGER, election_id INTEGER, student_id TEXT, created_at TEXT);
            INSERT INTO votes VALUES (1, 1, 'a', '2026-01-01T09:00:00'),
                (2, NULL, 'b', '2026-01-01T09:00:00');
            CREATE TABLE vote_items (vote_id INTEGER, position TEXT);
            INSERT INTO vote_items VALUES (1, 'Archived'), (2, 'Archived');
        ''')
        db = self.db
        self.errors = []
        errors = self.errors
        db.create_function('timezone', 2, lambda zone, value: value)
        db.create_function('date_trunc', 2, lambda unit, value: value[:13] + ':00:00')
        db.create_function('SPLIT_PART', 3, lambda value, sep, part: value.split(sep)[part-1])

        class Cursor:
            def __enter__(self):
                self.cursor = db.cursor()
                self.hourly = False
                self.ledger = False
                return self
            def __exit__(self, *args):
                self.cursor.close()
            def execute(self, sql, params=None):
                self.ledger = any(t in sql for t in ('vote_blocks', 'validator_nodes', 'block_validations'))
                if self.ledger:
                    return
                self.hourly = 'WITH hourly' in sql
                sql = sql.replace('::text', '').replace('%%', '%').replace('%s', '?')
                sql = sql.replace("POSITION('::' IN COALESCE(position,''))", "INSTR(COALESCE(position,''), '::')")
                sql = sql.replace('COUNT(DISTINCT (vote_id, position))', "COUNT(DISTINCT CAST(vote_id AS TEXT) || ':' || position)")
                try:
                    self.cursor.execute(sql, params or [])
                except Exception as exc:
                    errors.append((sql, str(exc)))
                    raise
            def fetchone(self):
                return (0, ) if self.ledger else self.cursor.fetchone()
            def fetchall(self):
                if self.ledger:
                    return []
                rows = self.cursor.fetchall()
                return [(datetime.fromisoformat(r[0]), r[1]) for r in rows] if self.hourly else rows
            @property
            def description(self):
                return [] if self.ledger else self.cursor.description

        self.ns = dict(connection=SimpleNamespace(cursor=Cursor), _active_election_id=lambda: 2,
            JsonResponse=lambda data, **kwargs: data, timedelta=timedelta)
        for name in ('_ensure_election_scoped_tables', '_ensure_votes_tables',
                     '_ensure_vote_blocks_table', '_ensure_validator_tables'):
            self.ns[name] = Mock()
        exec(compile(ast.Module(body=nodes, type_ignores=[]), '<results analytics>', 'exec'), self.ns)

    def result(self):
        result = self.ns['results_analytics_api'](SimpleNamespace(session={'student_id': 'a'}))
        self.assertEqual(self.errors, [])
        return result

    def add_current(self, count=1):
        for i, student in enumerate(('a', 'b', 'c')[:count], 3):
            self.db.execute('INSERT INTO votes VALUES (?, 2, ?, ?)', (i, student, '2026-11-12T08:00:00'))
            self.db.execute('INSERT INTO vote_items VALUES (?, ?)', (i, 'USG::President'))

    def test_empty_current_election_excludes_archived_and_legacy_ballots(self):
        r = self.result()
        self.assertEqual(r['election_id'], 2)
        self.assertEqual(r['turnout'], dict(eligible_voters=4, voted_students=0, turnout_percentage=0.0))
        self.assertEqual(r['participation_by_program'], dict(BSIT=0, BTLED=0, BFPT=0))
        self.assertFalse(r['peak_voting_time']['has_enough_data'])

    def test_turnout_matches_home_population_and_current_ballots(self):
        self.add_current()
        self.assertEqual(self.result()['turnout'], dict(eligible_voters=4, voted_students=1, turnout_percentage=25.0))

    def test_program_and_position_statistics_exclude_history(self):
        self.add_current()
        r = self.result()
        self.assertEqual(r['participation_by_program'], dict(BSIT=1, BTLED=0, BFPT=0))
        self.assertEqual(r['vote_completion']['most_voted_position'], 'President')
        self.assertEqual(r['vote_completion']['least_voted_position'], 'Secretary')
        self.assertEqual(r['vote_completion']['skipped_positions'], 1)
        self.assertEqual(r['vote_completion']['skipped_positions_percentage'], 50.0)

    def test_trend_and_peak_include_only_current_ballots(self):
        self.add_current(3)
        peak = self.result()['peak_voting_time']
        self.assertTrue(peak['has_enough_data'])
        self.assertEqual(peak['votes_submitted'], 3)
        self.assertEqual(len(peak['trend']), 1)
        self.assertEqual(peak['trend'][0]['votes'], 3)
        self.assertTrue(peak['trend'][0]['bucket_start'].startswith('2026-11-12'))

    def test_unauthenticated_request_is_rejected(self):
        self.assertFalse(self.ns['results_analytics_api'](SimpleNamespace(session={}))['ok'])


if __name__ == '__main__':
    unittest.main()
