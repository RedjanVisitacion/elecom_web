from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("elecom_voting", "0006_allow_vote_blocks_status_update"),
    ]

    operations = [
        migrations.CreateModel(
            name="FaceEnrollment",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("user_id", models.BigIntegerField(blank=True, null=True)),
                ("student_id", models.CharField(max_length=64)),
                ("face_image_url", models.TextField()),
                ("cloudinary_public_id", models.CharField(max_length=255)),
                ("enrollment_status", models.CharField(default="active", max_length=32)),
                ("enrolled_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "db_table": "face_enrollments",
            },
        ),
        migrations.CreateModel(
            name="FaceVerificationLog",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("student_id", models.CharField(max_length=64)),
                ("election_id", models.BigIntegerField(blank=True, null=True)),
                ("liveness_status", models.CharField(max_length=32)),
                ("verification_status", models.CharField(max_length=32)),
                ("match_score", models.DecimalField(blank=True, decimal_places=4, max_digits=5, null=True)),
                ("failure_reason", models.TextField(blank=True, null=True)),
                ("verified_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={
                "db_table": "face_verification_logs",
            },
        ),
        migrations.AddIndex(
            model_name="faceenrollment",
            index=models.Index(fields=["student_id", "enrollment_status"], name="face_enroll_student_status_idx"),
        ),
        migrations.AddIndex(
            model_name="faceenrollment",
            index=models.Index(fields=["enrolled_at"], name="face_enroll_enrolled_at_idx"),
        ),
        migrations.AddIndex(
            model_name="faceverificationlog",
            index=models.Index(fields=["student_id", "verified_at"], name="face_verify_student_verified_idx"),
        ),
        migrations.AddIndex(
            model_name="faceverificationlog",
            index=models.Index(fields=["election_id", "verified_at"], name="face_verify_election_verified_idx"),
        ),
        migrations.AddIndex(
            model_name="faceverificationlog",
            index=models.Index(fields=["verification_status"], name="face_verify_status_idx"),
        ),
    ]

