from django.core.management.base import BaseCommand
from core.admin_browser_push import deliver_admin_browser_pushes

class Command(BaseCommand):
    help = "Deliver new administrative browser alerts; schedule once per minute."
    def handle(self, *args, **options):
        count = deliver_admin_browser_pushes()
        self.stdout.write(f"Sent {count} admin browser push batches.")
