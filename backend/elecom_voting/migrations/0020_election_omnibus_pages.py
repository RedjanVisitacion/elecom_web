from django.db import migrations

class Migration(migrations.Migration):
    dependencies = [('elecom_voting', '0019_election_filing_slideshow')]
    operations = [migrations.RunSQL(
        "CREATE TABLE IF NOT EXISTS election_omnibus_pages (election_id BIGINT PRIMARY KEY, pages JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())",
        reverse_sql=migrations.RunSQL.noop,
    )]
