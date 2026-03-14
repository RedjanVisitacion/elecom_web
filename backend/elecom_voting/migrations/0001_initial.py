from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="Vote",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("student_id", models.CharField(max_length=64)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={
                "db_table": "votes",
            },
        ),
        migrations.CreateModel(
            name="VoteItem",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("position", models.CharField(max_length=128)),
                ("candidate_id", models.BigIntegerField()),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "vote",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="items", to="elecom_voting.vote"),
                ),
            ],
            options={
                "db_table": "vote_items",
            },
        ),
        migrations.AddConstraint(
            model_name="voteitem",
            constraint=models.UniqueConstraint(fields=("vote", "position"), name="ux_vote_items_vote_position"),
        ),
        migrations.AddIndex(
            model_name="vote",
            index=models.Index(fields=["student_id", "created_at"], name="votes_stude_630f09_idx"),
        ),
        migrations.AddIndex(
            model_name="voteitem",
            index=models.Index(fields=["position"], name="vote_items_position_5d0f59_idx"),
        ),
        migrations.AddIndex(
            model_name="voteitem",
            index=models.Index(fields=["candidate_id"], name="vote_items_candidate_93c3cf_idx"),
        ),
    ]
