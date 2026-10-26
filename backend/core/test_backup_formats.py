"""Exercise backup handlers with filesystem fixtures and no database writes.

Load just the handlers to avoid importing the unrelated biometric runtime.
"""
import ast
from contextlib import nullcontext
import io
import json
from pathlib import Path
import shutil
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import Mock
import zipfile
from core.backup_sql import inspect_sql


SQL = b'-- PostgreSQL database dump\nINSERT INTO users VALUES (1);\n'


class BackupFormatTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name).resolve()
        cursor = Mock()
        cursor.fetchone.return_value = ('password-hash',)
        self.restored = []
        self.env = dict(
            Path=Path, shutil=shutil, tempfile=tempfile, zipfile=zipfile, json=json,
            inspect_sql=inspect_sql,
            BACKUP_ALLOWED_TYPES={'postgres': {}, 'full_system': {}},
            BACKUP_RESTORE_SCOPES={'database'},
            _backup_root=lambda: self.root,
            _backup_filename=lambda kind, ext: f'elecom_{kind}.{ext}',
            _active_election_year=lambda: '2026',
            timezone=SimpleNamespace(now=lambda: SimpleNamespace(isoformat=lambda: '2026-10-27')),
            _run_pg_dump=lambda path, kind: path.write_bytes(SQL),
            _record_backup=Mock(return_value=1), _audit_log=Mock(),
            _require_admin=lambda request: None,
            connection=SimpleNamespace(cursor=lambda: nullcontext(cursor)),
            _verify_password=lambda stored, password: True,
            _run_psql_restore=lambda path, scope: self.restored.append(path.read_bytes()),
            JsonResponse=lambda data, status=200: SimpleNamespace(data=data, status_code=status),
        )
        tree = ast.parse(Path(__file__).with_name('views.py').read_text(encoding='utf-8'))
        functions = []
        for node in tree.body:
            if isinstance(node, ast.FunctionDef) and node.name in {
                '_create_backup_artifact', 'admin_backup_restore_api',
            }:
                node.decorator_list = []
                functions.append(node)
        exec(compile(ast.Module(body=functions, type_ignores=[]), 'views.py', 'exec'), self.env)

    def restore(self, filename, content):
        upload = SimpleNamespace(name=filename, chunks=lambda: [content])
        request = SimpleNamespace(content_type='multipart/form-data',
            POST={'password': 'test', 'scope': 'database'},
            FILES={'backup_file': upload}, session={'student_id': 'admin'})
        return self.env['admin_backup_restore_api'](request)

    def archive(self, name='database.sql', content=SQL):
        out = io.BytesIO()
        with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as archive:
            archive.writestr(name, content)
        return out.getvalue()

    def test_new_database_backup_is_plain_sql_and_restores(self):
        result = self.env['_create_backup_artifact']('postgres', 'admin')
        path = self.root / result['name']
        self.assertEqual(path.suffix, '.sql')
        self.assertEqual(path.read_bytes(), SQL)
        self.assertEqual(self.restore(path.name, path.read_bytes()).status_code, 200)
        self.assertEqual(self.restored, [SQL])

    def test_full_system_backup_remains_zip_and_restores(self):
        result = self.env['_create_backup_artifact']('full_system', 'admin')
        path = self.root / result['name']
        self.assertEqual(path.suffix, '.zip')
        with zipfile.ZipFile(path) as archive:
            self.assertIn('manifest.json', archive.namelist())
        self.assertEqual(self.restore(path.name, path.read_bytes()).status_code, 200)
        self.assertEqual(self.restored, [SQL])

    def test_legacy_zip_with_sql_extension_restores(self):
        self.assertEqual(self.restore('old (1).sql', self.archive()).status_code, 200)
        self.assertEqual(self.restored, [SQL])

    def test_archive_paths_are_never_extracted(self):
        self.assertEqual(self.restore('backup.zip', self.archive('../outside.sql')).status_code, 200)
        self.assertFalse((self.root / 'outside.sql').exists())
        self.assertEqual(self.restored, [SQL])

    def test_zip_without_sql_is_rejected(self):
        self.assertEqual(self.restore('backup.sql', self.archive('manifest.json', b'{}')).status_code, 400)
        self.assertEqual(self.restored, [])

    def test_invalid_files_are_rejected_before_restore(self):
        for name in ('invalid.zip', 'invalid.sql'):
            with self.subTest(name=name):
                self.assertEqual(self.restore(name, b'not a backup').status_code, 400)
        self.assertEqual(self.restored, [])
