import csv
import io
import json
import os
import unittest
from contextlib import nullcontext
from types import SimpleNamespace
from unittest.mock import Mock, patch

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
from django.core.files.uploadedfile import SimpleUploadedFile
from django.http import JsonResponse
from core import developer_users_csv as api


class UserCsvTests(unittest.TestCase):
    def setUp(self):
        self.validate = Mock(return_value='')
        self.upsert = Mock(return_value='')
        self.views = patch.dict('sys.modules', {'core.views': SimpleNamespace(
            _validate_voter_payload=self.validate, _upsert_voter_row=self.upsert)})
        self.views.start()
        self.addCleanup(self.views.stop)
        self.cursor = Mock()
        self.cursor.fetchall.return_value = [('20230001', 1)]
        self.db = patch.object(api, 'connection', SimpleNamespace(cursor=lambda: nullcontext(self.cursor)))
        self.db.start()
        self.addCleanup(self.db.stop)

    def upload(self, rows=None):
        stream = io.StringIO()
        writer = csv.writer(stream)
        writer.writerow(api.FIELDS)
        writer.writerows(rows or [['20230001', 'First', '', 'Last', 'first@example.com', 'BSIT', '1', 'A', '+639123456789', 'admin']])
        return SimpleUploadedFile('users.csv', stream.getvalue().encode('utf-8-sig'))

    def request(self, preview='1'):
        import hashlib
        rows = api.parse_csv(self.upload())
        digest = hashlib.sha256(json.dumps(rows, ensure_ascii=False, sort_keys=True).encode('utf-8')).hexdigest()
        return SimpleNamespace(method='POST', FILES={'file': self.upload()}, POST={'preview': preview, 'offset': '0', 'file_digest': digest})

    def large_upload(self):
        return self.upload([[str(20230000 + i), 'First', '', 'Last', 'first@example.com', 'BSIT', '1', 'A', '09123456789', 'student'] for i in range(620)])

    def test_large_file_validates_and_batches_250_250_120(self):
        import hashlib
        rows = api.parse_csv(self.large_upload())
        self.assertEqual(len(rows), 620)
        digest = hashlib.sha256(json.dumps(rows, ensure_ascii=False, sort_keys=True).encode('utf-8')).hexdigest()
        self.cursor.fetchall.return_value = []
        with patch.object(api, '_developer_admin', return_value=None), patch.object(api, 'transaction', SimpleNamespace(atomic=nullcontext)):
            for offset, count, processed in [(0, 250, 250), (250, 250, 500), (500, 120, 620)]:
                self.upsert.reset_mock()
                request = SimpleNamespace(method='POST', FILES={'file': self.large_upload()}, POST={'preview': '0', 'offset': str(offset), 'file_digest': digest})
                response = api.developer_users_csv_api(request)
                data = json.loads(response.content)
                self.assertEqual(response.status_code, 200, data)
                self.assertEqual(data['processed'], processed)
                self.assertEqual(data['created'], count)
                self.assertEqual(data['total'], 620)
                self.assertEqual(self.upsert.call_count, count)
                self.assertEqual(self.upsert.call_args_list[0].args[1]['student_id'], str(20230000 + offset))

    def test_invalid_offset_or_changed_file_does_not_write(self):
        for changes in [{'offset': '-1'}, {'offset': '1'}, {'offset': '250'}, {'file_digest': 'changed'}]:
            request = self.request('0')
            request.POST.update(changes)
            with patch.object(api, '_developer_admin', return_value=None):
                self.assertEqual(api.developer_users_csv_api(request).status_code, 400)
        self.upsert.assert_not_called()

    def test_roles_are_not_imported_and_phone_round_trips(self):
        row = api.parse_csv(self.upload())[0]
        self.assertEqual(row['role'], 'student')
        self.assertEqual(row['phone_number'], '+639123456789')

    def test_duplicate_ids_rejected(self):
        row = ['20230001', 'First', '', 'Last', 'first@example.com', 'BSIT', '1', 'A', '09123456789', 'student']
        with self.assertRaisesRegex(ValueError, 'duplicate'):
            api.parse_csv(self.upload([row, row]))

    def test_invalid_email_rejected(self):
        row = ['20230001', 'First', '', 'Last', 'invalid', 'BSIT', '1', 'A', '09123456789', 'student']
        with self.assertRaisesRegex(ValueError, 'email'):
            api.parse_csv(self.upload([row]))

    def test_missing_headers_rejected(self):
        with self.assertRaisesRegex(ValueError, 'headers'):
            api.parse_csv(SimpleUploadedFile('users.csv', b'student_id\n123\n'))

    def test_formula_cells_are_escaped(self):
        for cell in ['=SUM(A1)', '+639123456789', '-1', '@value', ' =1']:
            self.assertTrue(api.safe_cell(cell).startswith("'"))
        self.assertEqual(api.safe_cell('20230001'), '20230001')

    def test_gate_denies_export_and_import(self):
        with patch.object(api, '_developer_admin', return_value=JsonResponse({'ok': False}, status=403)):
            for method in ['POST', 'GET']:
                self.assertEqual(api.developer_users_csv_api(SimpleNamespace(method=method)).status_code, 403)
        self.cursor.execute.assert_not_called()

    def test_preview_does_not_write(self):
        with patch.object(api, '_developer_admin', return_value=None), patch.object(api, 'transaction', SimpleNamespace(atomic=nullcontext)):
            response = api.developer_users_csv_api(self.request())
        data = json.loads(response.content)
        self.assertEqual((data['created'], data['updated']), (0, 1))
        self.upsert.assert_not_called()

    def test_commit_uses_shared_upsert(self):
        with patch.object(api, '_developer_admin', return_value=None), patch.object(api, 'transaction', SimpleNamespace(atomic=nullcontext)):
            response = api.developer_users_csv_api(self.request('0'))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.upsert.call_args.args[1]['role'], 'student')

    def test_write_failure_exits_transaction_with_exception(self):
        atomic = Mock()
        atomic.__enter__ = Mock()
        atomic.__exit__ = Mock(return_value=False)
        self.upsert.side_effect = RuntimeError('database unavailable')
        with patch.object(api, '_developer_admin', return_value=None), patch.object(api, 'transaction', SimpleNamespace(atomic=lambda: atomic)), patch.object(api.logging, 'getLogger'):
            response = api.developer_users_csv_api(self.request('0'))
        self.assertEqual(response.status_code, 500)
        self.assertIs(atomic.__exit__.call_args.args[0], RuntimeError)

    def test_template_has_no_private_fields(self):
        request = SimpleNamespace(method='GET', GET={'template': '1'})
        with patch.object(api, '_developer_admin', return_value=None):
            response = api.developer_users_csv_api(request)
        self.assertEqual(response.content.decode('utf-8-sig').strip(), ','.join(api.FIELDS))
        self.assertEqual(response['Cache-Control'], 'private, no-store')
        self.cursor.execute.assert_not_called()

    def test_export_includes_all_batches(self):
        self.cursor.fetchmany.side_effect = [ [('20230001', 'First', '', 'Last', 'first@example.com', 'BSIT', 1, 'A', '+639123456789', 'admin')], []]
        with patch.object(api, '_developer_admin', return_value=None):
            response = api.developer_users_csv_api(SimpleNamespace(method='GET', GET={}))
        content = response.content.decode('utf-8-sig')
        self.assertIn("'+639123456789", content)
        self.assertNotIn('password', content)


if __name__ == '__main__':
    unittest.main()
