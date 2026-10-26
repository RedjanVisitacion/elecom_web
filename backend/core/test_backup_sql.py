from pathlib import Path
import tempfile
import tracemalloc
import unittest

from core.backup_sql import inspect_sql, sanitize_data_sql


class StreamingBackupTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.source = Path(self.tmp.name) / 'backup.sql'
        self.output = Path(self.tmp.name) / 'sanitized.sql'

    def test_markers_across_chunk_boundary_and_header(self):
        self.source.write_text('-- PostgreSQL database dump\n' + ' ' * (65536 - 30)
                               + 'users vote_items', encoding='utf-8')
        header, found = inspect_sql(self.source, {'users', 'vote_items', 'student'})
        self.assertIn('postgresql database dump', header)
        self.assertEqual(found, {'users', 'vote_items'})

    def test_sanitization_preserves_data_and_transaction(self):
        text = ('-- PostgreSQL database dump\nBEGIN;\nSET transaction_timeout = 0;\n'
                'INSERT INTO users VALUES (1, \'José\');\nCOMMIT;\n')
        self.source.write_text(text, encoding='utf-8')
        sanitize_data_sql(self.source, self.output)
        self.assertEqual(self.output.read_text(encoding='utf-8'),
                         text.replace('SET transaction_timeout',
                                      '-- Skipped unsupported PostgreSQL setting: SET transaction_timeout'))

    def test_large_data_backup_uses_bounded_memory(self):
        with self.source.open('w', encoding='utf-8', newline='\n') as output:
            output.write('-- PostgreSQL database dump\nBEGIN;\n')
            line = "INSERT INTO users VALUES (1, '" + 'x' * 2000 + "');\n"
            for _ in range(14000):
                output.write(line)
            # Embedded documents may make one INSERT exceptionally large.
            output.write("INSERT INTO users VALUES (2, '")
            for _ in range(1024):
                output.write('x' * 8192)
            output.write("');\n")
            output.write('COMMIT;\n')
        tracemalloc.start()
        try:
            _, found = inspect_sql(self.source, {'users', 'vote_items'})
            sanitize_data_sql(self.source, self.output)
            _, peak = tracemalloc.get_traced_memory()
        finally:
            tracemalloc.stop()
        self.assertEqual(found, {'users'})
        self.assertEqual(self.output.stat().st_size, self.source.stat().st_size)
        self.assertLess(peak, 2 * 1024 * 1024)
