from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("elecom_voting", "0005_ledger_security_hardening"),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
            -- Allow ONLY vote_blocks.block_status to be updated.
            -- This supports legacy backfill logic while still preventing tampering
            -- with hashes and linkage fields.
            CREATE OR REPLACE FUNCTION vote_blocks_allow_status_update_only() RETURNS trigger AS $$
            BEGIN
                IF TG_OP = 'DELETE' THEN
                    INSERT INTO audit_logs(table_name, record_id, action, old_data, new_data, changed_by, changed_at)
                    VALUES (TG_TABLE_NAME, OLD.id, 'unauthorized_delete_attempt', to_jsonb(OLD), NULL, current_user, NOW());
                    RAISE EXCEPTION 'Append-only ledger table: DELETE not permitted on %', TG_TABLE_NAME
                        USING ERRCODE = '42501';
                END IF;

                -- UPDATE: only block_status may change
                IF (NEW.election_id IS DISTINCT FROM OLD.election_id)
                   OR (NEW.vote_id IS DISTINCT FROM OLD.vote_id)
                   OR (NEW.anonymous_voter_hash IS DISTINCT FROM OLD.anonymous_voter_hash)
                   OR (NEW.vote_data_hash IS DISTINCT FROM OLD.vote_data_hash)
                   OR (NEW.previous_hash IS DISTINCT FROM OLD.previous_hash)
                   OR (NEW.current_hash IS DISTINCT FROM OLD.current_hash)
                   OR (NEW.submitted_at IS DISTINCT FROM OLD.submitted_at) THEN
                    INSERT INTO audit_logs(table_name, record_id, action, old_data, new_data, changed_by, changed_at)
                    VALUES (TG_TABLE_NAME, OLD.id, 'unauthorized_update_attempt', to_jsonb(OLD), to_jsonb(NEW), current_user, NOW());
                    RAISE EXCEPTION 'Append-only ledger table: UPDATE not permitted on % (except block_status)', TG_TABLE_NAME
                        USING ERRCODE = '42501';
                END IF;

                INSERT INTO audit_logs(table_name, record_id, action, old_data, new_data, changed_by, changed_at)
                VALUES (TG_TABLE_NAME, OLD.id, 'block_status_updated', to_jsonb(OLD), to_jsonb(NEW), current_user, NOW());

                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;

            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_vote_blocks_append_only') THEN
                    DROP TRIGGER trg_vote_blocks_append_only ON vote_blocks;
                END IF;
                CREATE TRIGGER trg_vote_blocks_append_only
                BEFORE UPDATE OR DELETE ON vote_blocks
                FOR EACH ROW EXECUTE FUNCTION vote_blocks_allow_status_update_only();
            END $$;
            """,
            reverse_sql=migrations.RunSQL.noop,
        )
    ]

