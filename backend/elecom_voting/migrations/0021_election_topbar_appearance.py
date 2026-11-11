from django.db import migrations

class Migration(migrations.Migration):
    dependencies = [('elecom_voting', '0020_election_omnibus_pages')]
    operations = [migrations.RunSQL(
        "CREATE TABLE IF NOT EXISTS election_topbar_appearance (election_id BIGINT PRIMARY KEY, image_url TEXT NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())",
        reverse_sql=migrations.RunSQL.noop,
    )]
