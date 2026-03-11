from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("elecom_auth", "0002_create_candidates_registration"),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
            ALTER TABLE IF EXISTS candidates_registration
                ADD COLUMN IF NOT EXISTS program VARCHAR(255);

            ALTER TABLE IF EXISTS candidates_registration
                ADD COLUMN IF NOT EXISTS year_section VARCHAR(255);

            ALTER TABLE IF EXISTS candidates_registration
                ADD COLUMN IF NOT EXISTS platform TEXT;

            ALTER TABLE IF EXISTS candidates_registration
                ADD COLUMN IF NOT EXISTS photo_url TEXT;

            ALTER TABLE IF EXISTS candidates_registration
                ADD COLUMN IF NOT EXISTS party_name VARCHAR(255);

            ALTER TABLE IF EXISTS candidates_registration
                ADD COLUMN IF NOT EXISTS candidate_type VARCHAR(64);

            ALTER TABLE IF EXISTS candidates_registration
                ADD COLUMN IF NOT EXISTS party_logo_url TEXT;
            """,
            reverse_sql=migrations.RunSQL.noop,
        )
    ]
