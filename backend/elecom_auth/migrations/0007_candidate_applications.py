from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("elecom_auth", "0006_student_id_number_text"),
    ]

    operations = [
        migrations.RunSQL(
            """
            CREATE TABLE IF NOT EXISTS candidate_applications (
                id SERIAL PRIMARY KEY,
                election_id INTEGER NULL,
                student_id VARCHAR(64) NOT NULL,
                first_name VARCHAR(255) NOT NULL,
                middle_name VARCHAR(255) DEFAULT '',
                last_name VARCHAR(255) NOT NULL,
                organization VARCHAR(255) NOT NULL,
                position VARCHAR(255) NOT NULL,
                program VARCHAR(255) NOT NULL,
                year_section VARCHAR(255) NOT NULL,
                platform TEXT NOT NULL,
                candidate_type VARCHAR(64) DEFAULT 'Independent',
                party_name VARCHAR(255) NULL,
                photo_url TEXT NOT NULL,
                photo_public_id VARCHAR(255) NULL,
                party_logo_url TEXT NULL,
                party_logo_public_id VARCHAR(255) NULL,
                status VARCHAR(32) NOT NULL DEFAULT 'pending',
                reviewed_by VARCHAR(64) NULL,
                reviewed_at TIMESTAMP NULL,
                rejection_reason TEXT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS ix_candidate_applications_status
                ON candidate_applications (status);
            CREATE INDEX IF NOT EXISTS ix_candidate_applications_student
                ON candidate_applications (student_id);
            CREATE INDEX IF NOT EXISTS ix_candidate_applications_election
                ON candidate_applications (COALESCE(election_id, 0));
            CREATE UNIQUE INDEX IF NOT EXISTS ux_candidate_applications_pending
                ON candidate_applications (COALESCE(election_id, 0), student_id, position)
                WHERE status = 'pending';
            """,
            reverse_sql="DROP TABLE IF EXISTS candidate_applications;",
        )
    ]
