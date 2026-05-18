from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("elecom_auth", "0005_candidates_registration_add_created_at_votes"),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
            CREATE TABLE IF NOT EXISTS student (
                id_number varchar(64) PRIMARY KEY,
                first_name varchar(255) NOT NULL,
                middle_name varchar(255) NOT NULL DEFAULT '',
                last_name varchar(255) NOT NULL,
                course varchar(255) NOT NULL,
                year integer NOT NULL,
                section varchar(255) NOT NULL,
                email varchar(255) NOT NULL,
                phone_number varchar(255) NOT NULL,
                role varchar(255) NOT NULL DEFAULT 'student'
            );

            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                student_id varchar(64) DEFAULT NULL,
                password_hash varchar(255) NOT NULL,
                created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
                role varchar(32) NOT NULL DEFAULT 'user',
                department varchar(128) DEFAULT NULL,
                year_level smallint DEFAULT NULL,
                section varchar(50) DEFAULT NULL,
                position varchar(128) DEFAULT NULL,
                phone varchar(32) DEFAULT NULL,
                email varchar(255) DEFAULT NULL,
                otp_code varchar(255) DEFAULT NULL,
                otp_expires_at timestamp DEFAULT NULL,
                terms_accepted_at timestamp DEFAULT NULL,
                first_name varchar(128) DEFAULT NULL,
                middle_name varchar(128) DEFAULT NULL,
                last_name varchar(128) DEFAULT NULL,
                photo_url text DEFAULT NULL
            );

            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_schema = 'public'
                      AND table_name = 'student'
                      AND column_name = 'id_number'
                      AND data_type NOT IN ('character varying', 'text')
                ) THEN
                    ALTER TABLE student
                    ALTER COLUMN id_number TYPE varchar(64)
                    USING id_number::text;
                END IF;
            END $$;

            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS photo_url text DEFAULT NULL;
            """,
            reverse_sql="""
            ALTER TABLE student
            ALTER COLUMN id_number TYPE bigint
            USING NULLIF(regexp_replace(id_number::text, '[^0-9]', '', 'g'), '')::bigint
            """,
        ),
        migrations.AlterField(
            model_name="elecomstudent",
            name="id_number",
            field=models.CharField(max_length=64, primary_key=True, serialize=False),
        ),
    ]
