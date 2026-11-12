"""Isolated endpoint regression checks; no production database or AI calls."""
import ast
import json
from contextlib import nullcontext
from pathlib import Path
from types import SimpleNamespace
from unittest import TestCase, main
from unittest.mock import Mock

tree = ast.parse(Path(__file__).with_name('views.py').read_text(encoding='utf-8'))
nodes = [n for n in tree.body if isinstance(n, ast.FunctionDef)
         and n.name in {'elevote_chat_api', '_elevote_support_state'}]
for node in nodes:
    node.decorator_list = []


class SupportTests(TestCase):
    def setUp(self):
        self.cursor = Mock()
        cursor_context = Mock()
        cursor_context.__enter__ = Mock(return_value=self.cursor)
        cursor_context.__exit__ = Mock(return_value=False)
        self.messages = Mock()
        self.ns = dict(connection=SimpleNamespace(cursor=lambda: cursor_context),
                       transaction=SimpleNamespace(atomic=nullcontext),
                       EleVoteChatMessage=self.messages, json=json,
                       JsonResponse=lambda data, **kwargs: (data, kwargs.get('status', 200)),
                       _ensure_elevote_chat_table=Mock(), _elevote_message_json=lambda row: row)
        exec(compile(ast.Module(body=nodes, type_ignores=[]), '<chat>', 'exec'), self.ns)

    def request(self, state, student='student-a'):
        self.cursor.fetchone.return_value = state
        request = SimpleNamespace(method='POST', session={'student_id': student},
                                  body=json.dumps({'action': 'request_admin', 'student_id': 'other'}).encode())
        return self.ns['elevote_chat_api'](request)

    def test_new_request_is_saved_for_authenticated_student(self):
        self.cursor.fetchone.side_effect = [(False, False), (False, True)]
        data, status = self.request((False, False))
        self.assertEqual(status, 200)
        self.assertTrue(data['admin_requested'])
        self.assertFalse(data['takeover_active'])
        self.messages.objects.create.assert_called_once()
        self.assertEqual(self.messages.objects.create.call_args.kwargs['student_id'], 'student-a')

    def test_duplicate_request_does_not_add_message(self):
        data, _ = self.request((False, True))
        self.assertTrue(data['admin_requested'])
        self.messages.objects.create.assert_not_called()

    def test_active_admin_cannot_be_overridden(self):
        data, _ = self.request((True, False))
        self.assertTrue(data['takeover_active'])
        self.assertFalse(data['admin_requested'])
        self.messages.objects.create.assert_not_called()

    def test_unauthenticated_request_rejected(self):
        _, status = self.request((False, False), student='')
        self.assertEqual(status, 401)
        self.messages.objects.create.assert_not_called()

    def test_initial_history_includes_support_state(self):
        self.cursor.fetchone.return_value = (True, False)
        self.messages.objects.filter.return_value.order_by.return_value = []
        request = SimpleNamespace(method='GET', session={'student_id': 'student-a'}, GET={})
        data, _ = self.ns['elevote_chat_api'](request)
        self.assertTrue(data['takeover_active'])


if __name__ == '__main__':
    main()

