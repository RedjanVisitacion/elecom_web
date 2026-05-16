from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("elecom_voting", "0009_widen_face_verification_match_score"),
    ]

    operations = [
        migrations.CreateModel(
            name="MobileTutorialState",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("student_id", models.CharField(max_length=64, unique=True)),
                ("login_done", models.BooleanField(default=False)),
                ("home_done", models.BooleanField(default=False)),
                ("voting_done", models.BooleanField(default=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "db_table": "mobile_tutorial_state",
            },
        ),
        migrations.AddIndex(
            model_name="mobiletutorialstate",
            index=models.Index(fields=["student_id"], name="mobile_tut_student_idx"),
        ),
        migrations.AddIndex(
            model_name="mobiletutorialstate",
            index=models.Index(fields=["updated_at"], name="mobile_tut_updated_idx"),
        ),
    ]
