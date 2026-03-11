from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("elecom_auth", "0003_candidates_registration_columns"),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
            CREATE TABLE IF NOT EXISTS vote_windows (
                id BIGSERIAL PRIMARY KEY,
                start_at TIMESTAMP NULL,
                end_at TIMESTAMP NULL,
                results_at TIMESTAMP NULL,
                note VARCHAR(255) NULL,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NULL
            );

            CREATE INDEX IF NOT EXISTS ix_vote_windows_created_at ON vote_windows (created_at);
            """,
            reverse_sql=migrations.RunSQL.noop,
        )
    ]
