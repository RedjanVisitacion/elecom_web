"""Isolated notification regression tests without production DB or FCM sends."""
import ast
from datetime import date, datetime
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock
import unittest

source = Path(__file__).with_name('views.py').read_text(encoding='utf-8')
tree = ast.parse(source)
names = {'_save_calendar_event_with_notifications', '_maybe_emit_election_broadcast_notifications',
         '_vote_window_schedule_sig', '_insert_broadcast_notifications'}
nodes = [n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name in names]
for n in nodes:
    n.decorator_list = []
    # Use injected queue mock in place of relative module imports.
    n.body = [b for b in n.body if not isinstance(b, ast.ImportFrom)]
ns = {}
exec(compile(ast.Module(body=nodes, type_ignores=[]), '<schedule tests>', 'exec'), ns)


class Cursor:
    def __init__(self, rows):
        self.rows = iter(rows)
        self.queries = []
    def __enter__(self): return self
    def __exit__(self, *args): pass
    def execute(self, sql, params=None): self.queries.append((sql, params))
    def fetchone(self): return next(self.rows)
    def fetchall(self): return [(10,), (11,)]


class ScheduleTests(unittest.TestCase):
    def setUp(self):
        self.broadcast = Mock()
        self.cursor = Cursor([])
        ns.update(connection=SimpleNamespace(cursor=lambda: self.cursor),
                  _bulk_insert_user_notifications_for_all_accounts=self.broadcast,
                  logger=Mock(), JsonResponse=lambda data, status=200: SimpleNamespace(data=data, status_code=status))

    def save(self, event_id=None):
        return ns['_save_calendar_event_with_notifications'](
            event_id, 'System Testing', '2026-10-14', None, '13:00', None, '', 'Campus', '#1D4ED8')

    def event_row(self):
        return (1, 'System Testing', date(2026, 10, 14), None, '', 'Campus', '#1D4ED8', datetime(2026, 10, 13), '13:00', None)

    def test_new_event_announces_title_date_time_location(self):
        self.cursor = Cursor([self.event_row()])
        result = self.save()
        self.assertEqual(result.status_code, 201)
        payload = self.broadcast.call_args.kwargs
        self.assertEqual(payload['notif_type'], 'schedule')
        for text in ('System Testing', '2026-10-14', '13:00', 'Campus', 'Philippine time'):
            self.assertIn(text, payload['body'])

    def test_edit_does_not_repeat_new_event_alert(self):
        self.cursor = Cursor([self.event_row()])
        self.assertEqual(self.save(1).status_code, 200)
        self.broadcast.assert_not_called()

    def test_missing_event_does_not_notify(self):
        self.cursor = Cursor([None])
        self.assertEqual(self.save(99).status_code, 404)
        self.broadcast.assert_not_called()

    def test_notification_failure_propagates_for_transaction_rollback(self):
        self.cursor = Cursor([self.event_row()])
        self.broadcast.side_effect = RuntimeError('queue failed')
        with self.assertRaises(RuntimeError): self.save()

    def emit(self, previous, announce=False):
        start = datetime(2026, 10, 14, 8)
        end = datetime(2026, 10, 19, 17)
        self.cursor = Cursor([previous, (1, start, end, None)])
        ns.update(_ensure_election_broadcast_state_table=lambda: None,
                  timezone=SimpleNamespace(now=lambda: datetime(2026, 10, 13)),
                  _compute_election_phases=lambda **kw: ('upcoming', 'pending'),
                  _election_datetime_local_for_admin_form=lambda dt: dt.isoformat())
        ns['_maybe_emit_election_broadcast_notifications'](announce_schedule=announce)

    def test_first_admin_save_announces_but_cold_poll_does_not(self):
        self.emit((0, '', '', ''), announce=True)
        self.broadcast.assert_called_once()
        self.assertIn('2026-10-14', self.broadcast.call_args.kwargs['body'])
        self.broadcast.reset_mock()
        self.emit((0, '', '', ''))
        self.broadcast.assert_not_called()

    def test_unchanged_schedule_does_not_duplicate_and_locks_marker(self):
        sig = ns['_vote_window_schedule_sig'](1, datetime(2026, 10, 14, 8), datetime(2026, 10, 19, 17), None)
        self.emit((1, 'upcoming', 'pending', sig), announce=True)
        self.broadcast.assert_not_called()
        self.assertIn('FOR UPDATE', self.cursor.queries[0][0])

    def test_voting_start_end_and_results_each_emit_once(self):
        sig = ns['_vote_window_schedule_sig'](1, datetime(2026, 10, 14, 8), datetime(2026, 10, 19, 17), None)
        for old_vote, new_vote, old_results, new_results, title in (
            ('upcoming', 'active', 'pending', 'pending', 'Voting has started'),
            ('active', 'closed', 'pending', 'pending', 'Voting has ended'),
            ('closed', 'closed', 'pending', 'published', 'Results are available'),
        ):
            self.emit((1, old_vote, old_results, sig))
            self.broadcast.reset_mock()
            self.cursor = Cursor([(1, old_vote, old_results, sig),
                                  (1, datetime(2026, 10, 14, 8), datetime(2026, 10, 19, 17), None)])
            ns['_compute_election_phases'] = lambda **kw: (new_vote, new_results)
            ns['_maybe_emit_election_broadcast_notifications']()
            self.broadcast.assert_called_once()
            self.assertEqual(self.broadcast.call_args.kwargs['title'], title)

    def test_inbox_and_outbox_share_ids_and_dispatch_only_after_commit(self):
        commits = []
        dispatch = Mock()
        ns.update(transaction=SimpleNamespace(on_commit=commits.append), dispatch_broadcast_pushes=dispatch)
        ns['_insert_broadcast_notifications'](notif_type='schedule', title='New event', body='Details')
        sql, params = self.cursor.queries[0]
        self.assertIn('WITH inserted AS', sql)
        self.assertIn('SELECT id, student_id, title, body FROM inserted', sql)
        self.assertIn('SELECT DISTINCT ON (notif_key)', sql)
        self.assertIn("u.id::text", sql)
        self.assertEqual(params, ['schedule', 'New event', 'Details'])
        dispatch.assert_not_called()
        commits[0]()
        dispatch.assert_called_once_with([10, 11])

    def test_election_date_post_branch_is_reachable_and_password_checked(self):
        node = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == 'admin_election_window_api')
        text = ast.unparse(node)
        self.assertIn('json.loads', text)
        self.assertIn('_verify_password', text)
        self.assertIn('announce_schedule=True', text)
        self.assertNotIn('APP_UPDATE', text)


if __name__ == '__main__': unittest.main()
