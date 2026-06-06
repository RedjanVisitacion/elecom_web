from __future__ import annotations

from django.core.management.base import BaseCommand

from core.views import _maybe_run_due_auto_backup


class Command(BaseCommand):
    help = "Run the ELECOM automatic backup if the configured schedule is due."

    def handle(self, *args, **options):
        status = _maybe_run_due_auto_backup()
        if status.get("error"):
            self.stderr.write(self.style.ERROR(f"Auto backup failed: {status['error']}"))
            return
        if status.get("ran"):
            backup = status.get("backup") or {}
            self.stdout.write(self.style.SUCCESS(f"Auto backup created: {backup.get('name', 'backup')}"))
            return
        next_due = status.get("next_due_at") or "not scheduled"
        self.stdout.write(f"No backup due. Next due: {next_due}")
