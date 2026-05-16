from django.db import migrations, models


# When django_migrations lists 0007 as applied but the tables were never created
# (manual DB reset, wrong database, etc.), a plain AddField on face_enrollments fails.
# This migration ensures tables + indexes exist, then syncs Django state.

_FACE_TABLES_SQL = """
CREATE TABLE IF NOT EXISTS face_enrollments (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NULL,
    student_id VARCHAR(64) NOT NULL,
    face_image_url TEXT NOT NULL,
    cloudinary_public_id VARCHAR(255) NOT NULL,
    enrollment_status VARCHAR(32) NOT NULL DEFAULT 'active',
    enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    facepp_face_token VARCHAR(64) NULL
);
ALTER TABLE face_enrollments ADD COLUMN IF NOT EXISTS facepp_face_token VARCHAR(64);

CREATE INDEX IF NOT EXISTS face_enroll_student_status_idx
    ON face_enrollments (student_id, enrollment_status);
CREATE INDEX IF NOT EXISTS face_enroll_enrolled_at_idx
    ON face_enrollments (enrolled_at);

CREATE TABLE IF NOT EXISTS face_verification_logs (
    id BIGSERIAL PRIMARY KEY,
    student_id VARCHAR(64) NOT NULL,
    election_id BIGINT NULL,
    liveness_status VARCHAR(32) NOT NULL,
    verification_status VARCHAR(32) NOT NULL,
    match_score NUMERIC(10,4) NULL,
    failure_reason TEXT NULL,
    verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS face_verify_student_verified_idx
    ON face_verification_logs (student_id, verified_at);
CREATE INDEX IF NOT EXISTS face_verify_election_verified_idx
    ON face_verification_logs (election_id, verified_at);
CREATE INDEX IF NOT EXISTS face_verify_status_idx
    ON face_verification_logs (verification_status);

ALTER TABLE face_verification_logs
    ALTER COLUMN match_score TYPE NUMERIC(10,4);
"""


class Migration(migrations.Migration):
    dependencies = [
        ("elecom_voting", "0007_face_enrollment_and_verification_logs"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    sql=_FACE_TABLES_SQL,
                    reverse_sql=migrations.RunSQL.noop,
                ),
            ],
            state_operations=[
                migrations.AddField(
                    model_name="faceenrollment",
                    name="facepp_face_token",
                    field=models.CharField(blank=True, max_length=64, null=True),
                ),
                migrations.AlterField(
                    model_name="faceverificationlog",
                    name="match_score",
                    field=models.DecimalField(
                        blank=True, decimal_places=4, max_digits=10, null=True
                    ),
                ),
            ],
        ),
    ]
