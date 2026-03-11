from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("elecom_auth", "0001_initial"),
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
                program VARCHAR(255) NOT NULL,
                year_section VARCHAR(255) NOT NULL,
                platform TEXT,
                photo_url TEXT,
                party_name VARCHAR(255),
                candidate_type VARCHAR(64),
                party_logo_url TEXT
            );

            CREATE INDEX IF NOT EXISTS idx_candidates_registration_position
                ON candidates_registration (position);

            CREATE INDEX IF NOT EXISTS idx_candidates_registration_org
                ON candidates_registration (organization);

            CREATE INDEX IF NOT EXISTS idx_candidates_registration_party
                ON candidates_registration (party_name);

            CREATE UNIQUE INDEX IF NOT EXISTS ux_candidates_registration_student_position
                ON candidates_registration (student_id, position);
            """,
            reverse_sql="""
            DROP TABLE IF EXISTS candidates_registration;
            """,
        )
    ]
