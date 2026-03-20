from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("elecom_voting", "0001_initial"),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
            CREATE TABLE IF NOT EXISTS votes (
                id BIGSERIAL PRIMARY KEY,
                student_id VARCHAR(64) NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );

            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1
                    FROM pg_indexes
                    WHERE schemaname = 'public'
                      AND indexname = 'votes_student_id_created_at_idx'
                ) THEN
                    CREATE INDEX votes_student_id_created_at_idx ON votes (student_id, created_at);
                END IF;
            END$$;

            CREATE TABLE IF NOT EXISTS vote_items (
                id BIGSERIAL PRIMARY KEY,
                vote_id BIGINT NOT NULL,
                position VARCHAR(128) NOT NULL,
                candidate_id BIGINT NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                CONSTRAINT fk_vote_items_vote_id FOREIGN KEY (vote_id) REFERENCES votes(id) ON DELETE CASCADE
            );

            ALTER TABLE vote_items
                ADD COLUMN IF NOT EXISTS vote_id BIGINT;

            ALTER TABLE vote_items
                ADD COLUMN IF NOT EXISTS position VARCHAR(128);

            ALTER TABLE vote_items
                ADD COLUMN IF NOT EXISTS candidate_id BIGINT;

            ALTER TABLE vote_items
                ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

            UPDATE vote_items
                SET created_at = NOW()
            WHERE created_at IS NULL;

            ALTER TABLE vote_items
                ALTER COLUMN created_at SET DEFAULT NOW();

            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1
                    FROM pg_constraint
                    WHERE conname = 'ux_vote_items_vote_position'
                ) THEN
                    ALTER TABLE vote_items DROP CONSTRAINT ux_vote_items_vote_position;
                END IF;
            END$$;

            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1
                    FROM pg_constraint
                    WHERE conname = 'fk_vote_items_vote_id'
                ) THEN
                    ALTER TABLE vote_items
                        ADD CONSTRAINT fk_vote_items_vote_id FOREIGN KEY (vote_id) REFERENCES votes(id) ON DELETE CASCADE;
                END IF;
            END$$;

            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1
                    FROM pg_indexes
                    WHERE schemaname = 'public'
                      AND indexname = 'vote_items_position_idx'
                ) THEN
                    CREATE INDEX vote_items_position_idx ON vote_items (position);
                END IF;
                IF NOT EXISTS (
                    SELECT 1
                    FROM pg_indexes
                    WHERE schemaname = 'public'
                      AND indexname = 'vote_items_candidate_id_idx'
                ) THEN
                    CREATE INDEX vote_items_candidate_id_idx ON vote_items (candidate_id);
                END IF;
            END$$;
            """,
            reverse_sql=migrations.RunSQL.noop,
        ),
    ]
