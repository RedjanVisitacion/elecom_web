from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [("elecom_voting", "0016_face_enrollment_local_encoding")]
    operations = [migrations.RunSQL(
        sql="""
            CREATE TABLE IF NOT EXISTS mobile_push_tokens (
                token TEXT PRIMARY KEY,
                student_id VARCHAR(64) NOT NULL,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS mobile_push_tokens_student_idx ON mobile_push_tokens(student_id);
            CREATE TABLE IF NOT EXISTS candidate_push_outbox (
                notification_id BIGINT PRIMARY KEY,
                student_id VARCHAR(64) NOT NULL,
                title TEXT NOT NULL,
                body TEXT NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                sent_at TIMESTAMPTZ NULL,
                delivered_tokens TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
                attempts INTEGER NOT NULL DEFAULT 0
            );
            CREATE INDEX IF NOT EXISTS candidate_push_outbox_pending_idx
                ON candidate_push_outbox(created_at) WHERE sent_at IS NULL;
        """,
        reverse_sql="DROP TABLE candidate_push_outbox; DROP TABLE mobile_push_tokens;",
    )]
