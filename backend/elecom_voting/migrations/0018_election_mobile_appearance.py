from django.db import migrations

class Migration(migrations.Migration):
    dependencies = [("elecom_voting", "0017_candidate_push_notifications")]
    operations = [migrations.RunSQL(
        sql="""CREATE TABLE IF NOT EXISTS election_mobile_appearance (
            election_id BIGINT PRIMARY KEY,
            filing_background_url TEXT NOT NULL,
            cloudinary_public_id TEXT NOT NULL,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )""",
        reverse_sql=migrations.RunSQL.noop,
    )]
