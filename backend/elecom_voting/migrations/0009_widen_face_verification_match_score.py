from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("elecom_voting", "0008_face_enrollment_facepp_and_log_score"),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
            ALTER TABLE IF EXISTS face_verification_logs
            ALTER COLUMN match_score TYPE NUMERIC(10,4);
            """,
            reverse_sql=migrations.RunSQL.noop,
        ),
    ]

