from django.core.management.base import BaseCommand
from core.candidate_push import deliver_pending_candidate_pushes


class Command(BaseCommand):
    help = "Retry queued candidate-filing push notifications (run once a minute)."

    def add_arguments(self, parser):
        parser.add_argument("--limit", type=int, default=100)

    def handle(self, *args, **options):
        count = deliver_pending_candidate_pushes(limit=max(1, min(options["limit"], 1000)))
        self.stdout.write(f"Checked {count} queued candidate notifications.")
