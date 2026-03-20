from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("elecom_voting", "0002_fix_votes_tables"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    sql="""
                    DO $$
                    BEGIN
                        IF EXISTS (
                            SELECT 1
                            FROM pg_constraint
                            WHERE conname = 'ux_vote_items_vote_position'
                        ) THEN
                            ALTER TABLE vote_items DROP CONSTRAINT ux_vote_items_vote_position;
                        END IF;

                        IF NOT EXISTS (
                            SELECT 1
                            FROM pg_constraint
                            WHERE conname = 'ux_vote_items_vote_position_candidate'
                        ) THEN
                            ALTER TABLE vote_items
                                ADD CONSTRAINT ux_vote_items_vote_position_candidate UNIQUE (vote_id, position, candidate_id);
                        END IF;
                    END$$;
                    """,
                    reverse_sql=migrations.RunSQL.noop,
                ),
            ],
            state_operations=[
                migrations.RemoveConstraint(
                    model_name="voteitem",
                    name="ux_vote_items_vote_position",
                ),
                migrations.AddConstraint(
                    model_name="voteitem",
                    constraint=models.UniqueConstraint(
                        fields=("vote", "position", "candidate_id"),
                        name="ux_vote_items_vote_position_candidate",
                    ),
                ),
            ],
        )
    ]
