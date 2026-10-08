from django.core.management.base import BaseCommand
from core.candidate_filing_schema import ensure_candidate_filing_schema

class Command(BaseCommand):
    help = 'Recreate missing filing/COC tables and constraints; preserve surviving archives.'
    requires_system_checks = []

    def handle(self, *args, **options):
        ensure_candidate_filing_schema(force=True)
        self.stdout.write(self.style.SUCCESS('Filing/COC schema repaired. Deleted records are not restored. Re-save COC settings if they were deleted.'))
