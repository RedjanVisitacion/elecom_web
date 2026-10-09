import unittest
from contextlib import nullcontext
from unittest.mock import Mock, patch
from core import candidate_filing_schema as schema

class RecoveryTests(unittest.TestCase):
    def run_recovery(self, existing, rows, force=False):
        cur = Mock()
        cur.fetchall.return_value = [(value,) for value in existing]
        cur.fetchone.side_effect = rows
        connection = Mock()
        connection.cursor.return_value = nullcontext(cur)
        with patch.object(schema, 'connection', connection), patch.object(schema.transaction, 'atomic', return_value=nullcontext()):
            changed = schema.ensure_candidate_filing_schema(force=force)
        return changed, cur.execute.call_args_list

    def test_healthy_database_skips_ddl(self):
        changed, calls = self.run_recovery([True]*5, [(True, 4, 3)])
        self.assertFalse(changed)
        self.assertEqual(len(calls), 2)

    def test_deleted_parent_restores_constraints_without_reusing_archive_ids(self):
        changed, calls = self.run_recovery([False, True, True, True, True], [None, None, None, (42,), ('public.candidate_applications_id_seq',), (1,)])
        self.assertTrue(changed)
        sql = '\n'.join(call.args[0] for call in calls)
        self.assertIn('pg_advisory_xact_lock', sql)
        self.assertEqual(sql.count('NOT VALID'), 3)
        self.assertNotIn('DELETE FROM', sql)
        self.assertNotIn('DROP TABLE', sql)
        self.assertEqual(calls[-1].args[1], ['public.candidate_applications_id_seq', 42])

    def test_missing_signature_column_and_final_table_are_recreated(self):
        changed, calls = self.run_recovery([True]*5, [(False, 0, 2), (1,), (1,), None, (0,), ('public.candidate_applications_id_seq',)])
        self.assertTrue(changed)
        sql = '\n'.join(call.args[0] for call in calls)
        self.assertIn('ADD COLUMN IF NOT EXISTS chairperson_signature_bytes', sql)
        self.assertIn('CREATE TABLE IF NOT EXISTS candidate_certificate_finalizations', sql)

    def test_missing_formatting_columns_are_repaired_without_dropping_data(self):
        changed, calls = self.run_recovery([True]*5, [(True, 0, 3), (1,), (1,), (1,), (0,), ('public.candidate_applications_id_seq',)])
        self.assertTrue(changed)
        sql = '\n'.join(call.args[0] for call in calls)
        for key in ('name_is_bold', 'name_is_italic', 'year_is_bold', 'year_is_italic'):
            self.assertIn(f'ADD COLUMN IF NOT EXISTS {key} BOOLEAN NOT NULL DEFAULT FALSE', sql)
        self.assertNotIn('DROP', sql)

    def test_existing_sequence_is_not_lowered(self):
        changed, calls = self.run_recovery([False]*5, [(1,), (1,), (1,), (42,), ('public.candidate_applications_id_seq',), (100,)])
        self.assertTrue(changed)
        self.assertFalse(any('setval(' in call.args[0] for call in calls))

if __name__ == '__main__':
    unittest.main()
