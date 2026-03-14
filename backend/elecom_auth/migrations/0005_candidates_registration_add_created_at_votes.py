from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("elecom_auth", "0004_create_vote_windows"),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
            CREATE TABLE IF NOT EXISTS candidates_registration (
                id BIGSERIAL PRIMARY KEY,
                student_id VARCHAR(64) NOT NULL,
                first_name VARCHAR(255) NOT NULL,
                middle_name VARCHAR(255),
                last_name VARCHAR(255) NOT NULL,
                organization VARCHAR(255) NOT NULL,
                position VARCHAR(255) NOT NULL,
                program VARCHAR(255),
                year_section VARCHAR(255),
                platform TEXT,
                photo_url TEXT,
                party_name VARCHAR(255),
                candidate_type VARCHAR(64),
                party_logo_url TEXT,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                votes INTEGER NOT NULL DEFAULT 0
            );

            DO $$
            BEGIN
                IF to_regclass('public.candidates_registration') IS NULL THEN
                    RETURN;
                END IF;

                ALTER TABLE candidates_registration
                    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NULL;

                ALTER TABLE candidates_registration
                    ADD COLUMN IF NOT EXISTS votes INTEGER;

                UPDATE candidates_registration
                SET created_at = COALESCE(created_at, CURRENT_TIMESTAMP)
                WHERE created_at IS NULL;

                UPDATE candidates_registration
                SET votes = COALESCE(votes, 0)
                WHERE votes IS NULL;

                ALTER TABLE candidates_registration
                    ALTER COLUMN created_at SET NOT NULL;

                ALTER TABLE candidates_registration
                    ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;

                ALTER TABLE candidates_registration
                    ALTER COLUMN votes SET NOT NULL;

                ALTER TABLE candidates_registration
                    ALTER COLUMN votes SET DEFAULT 0;

                CREATE INDEX IF NOT EXISTS ix_candidates_registration_created_at
                    ON candidates_registration (created_at);

                CREATE INDEX IF NOT EXISTS ix_candidates_registration_votes
                    ON candidates_registration (votes);
            END $$;
            """,
            reverse_sql=migrations.RunSQL.noop,
        )
    ]
