from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("elecom_voting", "0012_election_scoped_records"),
    ]

    operations = [
        migrations.CreateModel(
            name="EleVoteChatMessage",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("student_id", models.CharField(max_length=64)),
                ("role", models.CharField(max_length=16)),
                ("content", models.TextField()),
                ("model", models.CharField(blank=True, max_length=128, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={
                "db_table": "elevote_chat_messages",
                "indexes": [
                    models.Index(fields=["student_id", "created_at"], name="elevote_student_created_idx"),
                    models.Index(fields=["role"], name="elevote_role_idx"),
                ],
            },
        ),
    ]
