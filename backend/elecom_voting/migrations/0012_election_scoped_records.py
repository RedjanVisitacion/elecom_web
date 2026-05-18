from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("elecom_voting", "0011_network_authorization_tables"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[],
            state_operations=[
                migrations.RenameIndex(
                    model_name="faceenrollment",
                    old_name="face_enroll_student_status_idx",
                    new_name="face_enroll_student_5caf69_idx",
                ),
                migrations.RenameIndex(
                    model_name="faceenrollment",
                    old_name="face_enroll_enrolled_at_idx",
                    new_name="face_enroll_enrolle_520352_idx",
                ),
                migrations.RenameIndex(
                    model_name="faceverificationlog",
                    old_name="face_verify_student_verified_idx",
                    new_name="face_verifi_student_a3d32a_idx",
                ),
                migrations.RenameIndex(
                    model_name="faceverificationlog",
                    old_name="face_verify_election_verified_idx",
                    new_name="face_verifi_electio_28cedc_idx",
                ),
                migrations.RenameIndex(
                    model_name="faceverificationlog",
                    old_name="face_verify_status_idx",
                    new_name="face_verifi_verific_8f29c6_idx",
                ),
                migrations.RenameIndex(
                    model_name="mobiletutorialstate",
                    old_name="mobile_tut_student_idx",
                    new_name="mobile_tuto_student_607a10_idx",
                ),
                migrations.RenameIndex(
                    model_name="mobiletutorialstate",
                    old_name="mobile_tut_updated_idx",
                    new_name="mobile_tuto_updated_61d84a_idx",
                ),
                migrations.RenameIndex(
                    model_name="vote",
                    old_name="votes_stude_630f09_idx",
                    new_name="votes_student_50c58f_idx",
                ),
                migrations.RenameIndex(
                    model_name="voteitem",
                    old_name="vote_items_position_5d0f59_idx",
                    new_name="vote_items_positio_a23bbb_idx",
                ),
                migrations.RenameIndex(
                    model_name="voteitem",
                    old_name="vote_items_candidate_93c3cf_idx",
                    new_name="vote_items_candida_645f6c_idx",
                ),
            ],
        ),
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    """
                    ALTER TABLE IF EXISTS votes
                    ADD COLUMN IF NOT EXISTS election_id BIGINT NULL;

                    ALTER TABLE IF EXISTS vote_items
                    ADD COLUMN IF NOT EXISTS election_id BIGINT NULL;

                    CREATE INDEX IF NOT EXISTS votes_electio_50a328_idx
                    ON votes (election_id, student_id);

                    CREATE INDEX IF NOT EXISTS vote_items_electio_209f9b_idx
                    ON vote_items (election_id, candidate_id);
                    """,
                    reverse_sql=migrations.RunSQL.noop,
                )
            ],
            state_operations=[
                migrations.AddField(
                    model_name="vote",
                    name="election_id",
                    field=models.BigIntegerField(blank=True, null=True),
                ),
                migrations.AddField(
                    model_name="voteitem",
                    name="election_id",
                    field=models.BigIntegerField(blank=True, null=True),
                ),
                migrations.AddIndex(
                    model_name="vote",
                    index=models.Index(fields=["election_id", "student_id"], name="votes_electio_50a328_idx"),
                ),
                migrations.AddIndex(
                    model_name="voteitem",
                    index=models.Index(fields=["election_id", "candidate_id"], name="vote_items_electio_209f9b_idx"),
                ),
            ],
        ),
        migrations.RunSQL(
            """
            ALTER TABLE IF EXISTS candidates_registration
            ADD COLUMN IF NOT EXISTS election_id BIGINT NULL;

            CREATE INDEX IF NOT EXISTS ix_candidates_registration_election_id
            ON candidates_registration (election_id);

            DROP INDEX IF EXISTS ux_candidates_registration_student_position;

            CREATE UNIQUE INDEX IF NOT EXISTS ux_candidates_registration_election_student_position
            ON candidates_registration (COALESCE(election_id, 0), student_id, position);
            """,
            reverse_sql=migrations.RunSQL.noop,
        ),
    ]
