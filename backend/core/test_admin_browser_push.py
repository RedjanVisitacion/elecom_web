from contextlib import nullcontext
import json
from types import SimpleNamespace
from unittest import TestCase
from unittest.mock import MagicMock, patch

from django.middleware.csrf import CsrfViewMiddleware
from django.test import RequestFactory, override_settings
from core import admin_browser_push as push


class AdminBrowserPushTests(TestCase):
    def test_config_exposes_only_browser_fields(self):
        with override_settings(ADMIN_FIREBASE_WEB_CONFIG=json.dumps({'apiKey': 'public', 'private_key': 'never expose'})):
            self.assertEqual(push.public_config(), {'apiKey': 'public'})

    def test_students_cannot_read_push_config(self):
        request = RequestFactory().get('/api/admin/notifications/browser-push/')
        request.session = {'role': 'student'}
        self.assertEqual(push.browser_push_api(request).status_code, 403)

    def test_subscription_requires_csrf(self):
        request = RequestFactory().post('/api/admin/notifications/browser-push/', data='{}', content_type='application/json')
        response = CsrfViewMiddleware(lambda request: None).process_view(request, push.browser_push_api, (), {})
        self.assertEqual(response.status_code, 403)

    def test_invalid_token_rejected(self):
        for token in ['', None, [], 'x' * 4097]:
            request = RequestFactory().post('/api/admin/notifications/browser-push/', data=json.dumps({'token': token}), content_type='application/json')
            request.session = {'role': 'admin'}
            self.assertEqual(push.browser_push_api(request).status_code, 400)

    def test_seen_alerts_are_not_replayed(self):
        self.assertEqual(push.unseen_alerts([{'id': 'a'}, {'id': 'b'}], ['a']), [{'id': 'b'}])
        self.assertEqual(push.unseen_alerts([{'id': 'a'}], ['a']), [])

    def _deliver(self, live=True, failure=False, seen=None):
        cursor = MagicMock()
        cursor.fetchall.return_value = [('device-token',)]
        cursor.fetchone.return_value = ('session-key', seen or [])
        messaging = SimpleNamespace(Message=lambda **kw: kw, Notification=lambda **kw: kw,
            WebpushConfig=lambda **kw: kw, WebpushNotification=lambda **kw: kw, send=MagicMock())
        if failure:
            messaging.send.side_effect = RuntimeError('temporary failure')
        with patch.object(push, 'ensure_tables'), patch.object(push.connection, 'cursor') as cur, \
             patch.object(push.transaction, 'atomic', side_effect=lambda: nullcontext()), \
             patch.object(push, 'live_admin_session', return_value=live), \
             patch('core.views.collect_admin_alerts', return_value=[{'id': 'new', 'body': 'Private student information'}]), \
             patch('core.candidate_push._messaging', return_value=messaging):
            cur.return_value.__enter__.return_value = cursor
            count = push.deliver_admin_browser_pushes()
        return count, cursor, messaging

    def test_push_contains_no_student_or_session_details(self):
        count, cursor, messaging = self._deliver()
        self.assertEqual(count, 1)
        payload = messaging.send.call_args.args[0]
        self.assertNotIn('Private student information', str(payload))
        self.assertNotIn('session-key', str(payload))
        self.assertEqual(payload['data']['alert_id'], 'new')

    def test_logged_out_devices_are_removed_without_sending(self):
        count, cursor, messaging = self._deliver(live=False)
        self.assertEqual(count, 0)
        messaging.send.assert_not_called()
        self.assertTrue(any('DELETE FROM admin_browser_push' in call.args[0] for call in cursor.execute.call_args_list))

    def test_failed_sends_remain_pending_for_retry(self):
        count, cursor, messaging = self._deliver(failure=True)
        self.assertEqual(count, 0)
        self.assertFalse(any('SET seen_ids' in call.args[0] for call in cursor.execute.call_args_list))

    def test_already_delivered_batch_does_not_send_again(self):
        count, cursor, messaging = self._deliver(seen=['new'])
        self.assertEqual(count, 0)
        messaging.send.assert_not_called()

    def test_missing_backup_alert_id_is_stable(self):
        from core import views
        cursor = MagicMock()
        cursor.fetchall.return_value = []
        cursor.fetchone.return_value = (0, None)
        with patch.multiple(views, _ensure_candidate_applications_table=lambda: None,
                _ensure_backup_tables=lambda: None, _ensure_votes_tables=lambda: None,
                _ensure_vote_blocks_table=lambda: None, _ensure_vote_item_change_audit_table=lambda: None,
                _ensure_network_authorization_tables=lambda cur: None, _current_election_id=lambda: 1), \
             patch.object(views.connection, 'cursor') as cur:
            cur.return_value.__enter__.return_value = cursor
            cursor.fetchone.side_effect = [(0, None), None, (None,), (0, None)] * 2
            first = views.collect_admin_alerts()
            second = views.collect_admin_alerts()
        self.assertEqual(first[0]['id'], second[0]['id'])
