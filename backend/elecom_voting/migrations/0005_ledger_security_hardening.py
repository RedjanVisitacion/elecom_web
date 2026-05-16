from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("elecom_voting", "0004_apprating_and_more"),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
            -- Crypto support for SHA-256 digests
            CREATE EXTENSION IF NOT EXISTS pgcrypto;

            -- Central audit log (db-level)
            CREATE TABLE IF NOT EXISTS audit_logs (
                id BIGSERIAL PRIMARY KEY,
                table_name VARCHAR(80) NOT NULL,
                record_id BIGINT NULL,
                action VARCHAR(40) NOT NULL,
                old_data JSONB NULL,
                new_data JSONB NULL,
                changed_by VARCHAR(80) NULL,
                changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_audit_logs_changed_at ON audit_logs (changed_at DESC, id DESC);
            CREATE INDEX IF NOT EXISTS idx_audit_logs_table_action ON audit_logs (table_name, action, changed_at DESC);

            -- Ledger tables (ensure exist even if API wasn't hit yet)
            CREATE TABLE IF NOT EXISTS vote_blocks (
                id BIGSERIAL PRIMARY KEY,
                election_id BIGINT NULL,
                vote_id BIGINT NULL,
                anonymous_voter_hash VARCHAR(128) NOT NULL,
                vote_data_hash VARCHAR(128) NOT NULL,
                previous_hash VARCHAR(128) NULL,
                current_hash VARCHAR(128) NOT NULL,
                submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                block_status VARCHAR(20) NOT NULL DEFAULT 'pending'
            );
            CREATE INDEX IF NOT EXISTS idx_vote_blocks_submitted ON vote_blocks(submitted_at DESC, id DESC);

            CREATE TABLE IF NOT EXISTS validator_nodes (
                id BIGSERIAL PRIMARY KEY,
                node_name VARCHAR(120) NOT NULL,
                node_role VARCHAR(80) NOT NULL,
                public_key TEXT NOT NULL,
                is_active BOOLEAN NOT NULL DEFAULT TRUE,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS block_validations (
                id BIGSERIAL PRIMARY KEY,
                vote_block_id BIGINT NOT NULL,
                validator_node_id BIGINT NOT NULL,
                validation_status VARCHAR(20) NOT NULL,
                validation_message TEXT,
                validated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_block_validations_block ON block_validations(vote_block_id, validated_at DESC);

            -- Election final hash storage
            CREATE TABLE IF NOT EXISTS election_final_hashes (
                id BIGSERIAL PRIMARY KEY,
                election_id BIGINT NOT NULL,
                total_vote_blocks BIGINT NOT NULL,
                final_hash VARCHAR(128) NOT NULL,
                computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
            CREATE UNIQUE INDEX IF NOT EXISTS ux_election_final_hashes_election_id ON election_final_hashes(election_id);

            -- Generic audit trigger (row-level)
            CREATE OR REPLACE FUNCTION audit_row_change() RETURNS trigger AS $$
            DECLARE
                rec_id BIGINT;
            BEGIN
                rec_id := NULL;
                BEGIN
                    rec_id := COALESCE(NEW.id, OLD.id);
                EXCEPTION WHEN others THEN
                    rec_id := NULL;
                END;

                IF (TG_OP = 'UPDATE') THEN
                    INSERT INTO audit_logs(table_name, record_id, action, old_data, new_data, changed_by, changed_at)
                    VALUES (TG_TABLE_NAME, rec_id, 'updated', to_jsonb(OLD), to_jsonb(NEW), current_user, NOW());
                    RETURN NEW;
                ELSIF (TG_OP = 'INSERT') THEN
                    INSERT INTO audit_logs(table_name, record_id, action, old_data, new_data, changed_by, changed_at)
                    VALUES (TG_TABLE_NAME, rec_id, 'inserted', NULL, to_jsonb(NEW), current_user, NOW());
                    RETURN NEW;
                ELSIF (TG_OP = 'DELETE') THEN
                    INSERT INTO audit_logs(table_name, record_id, action, old_data, new_data, changed_by, changed_at)
                    VALUES (TG_TABLE_NAME, rec_id, 'deleted', to_jsonb(OLD), NULL, current_user, NOW());
                    RETURN OLD;
                END IF;
                RETURN NULL;
            END;
            $$ LANGUAGE plpgsql;

            -- Append-only guard
            CREATE OR REPLACE FUNCTION deny_update_delete() RETURNS trigger AS $$
            DECLARE
                rec_id BIGINT;
            BEGIN
                rec_id := NULL;
                BEGIN
                    rec_id := COALESCE(NEW.id, OLD.id);
                EXCEPTION WHEN others THEN
                    rec_id := NULL;
                END;

                INSERT INTO audit_logs(table_name, record_id, action, old_data, new_data, changed_by, changed_at)
                VALUES (
                    TG_TABLE_NAME,
                    rec_id,
                    'unauthorized_update_delete_attempt',
                    to_jsonb(OLD),
                    CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(NEW) ELSE NULL END,
                    current_user,
                    NOW()
                );

                RAISE EXCEPTION 'Append-only ledger table: % operation not permitted on %', TG_OP, TG_TABLE_NAME
                    USING ERRCODE = '42501';
            END;
            $$ LANGUAGE plpgsql;

            -- Install append-only triggers on ledger tables
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_votes_append_only') THEN
                    CREATE TRIGGER trg_votes_append_only
                    BEFORE UPDATE OR DELETE ON votes
                    FOR EACH ROW EXECUTE FUNCTION deny_update_delete();
                END IF;

                IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_vote_items_append_only') THEN
                    CREATE TRIGGER trg_vote_items_append_only
                    BEFORE UPDATE OR DELETE ON vote_items
                    FOR EACH ROW EXECUTE FUNCTION deny_update_delete();
                END IF;

                IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_vote_blocks_append_only') THEN
                    CREATE TRIGGER trg_vote_blocks_append_only
                    BEFORE UPDATE OR DELETE ON vote_blocks
                    FOR EACH ROW EXECUTE FUNCTION deny_update_delete();
                END IF;

                IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_block_validations_append_only') THEN
                    CREATE TRIGGER trg_block_validations_append_only
                    BEFORE UPDATE OR DELETE ON block_validations
                    FOR EACH ROW EXECUTE FUNCTION deny_update_delete();
                END IF;
            END $$;

            -- Audit candidate + election schedule changes (allowed, but logged)
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_candidates_audit') THEN
                    CREATE TRIGGER trg_candidates_audit
                    AFTER INSERT OR UPDATE OR DELETE ON candidates_registration
                    FOR EACH ROW EXECUTE FUNCTION audit_row_change();
                END IF;

                IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_vote_windows_audit') THEN
                    CREATE TRIGGER trg_vote_windows_audit
                    AFTER INSERT OR UPDATE OR DELETE ON vote_windows
                    FOR EACH ROW EXECUTE FUNCTION audit_row_change();
                END IF;
            END $$;

            -- Final election hash function (hashes ordered block hashes)
            CREATE OR REPLACE FUNCTION compute_election_final_hash(p_election_id BIGINT)
            RETURNS TABLE(total_blocks BIGINT, final_hash TEXT) AS $$
            DECLARE
                agg TEXT;
                cnt BIGINT;
            BEGIN
                SELECT COUNT(*), COALESCE(string_agg(current_hash, '|' ORDER BY id), '')
                INTO cnt, agg
                FROM vote_blocks
                WHERE COALESCE(election_id, 0) = COALESCE(p_election_id, 0);

                RETURN QUERY
                SELECT
                    cnt,
                    encode(digest(COALESCE(p_election_id,0)::text || '|' || cnt::text || '|' || agg, 'sha256'), 'hex');
            END;
            $$ LANGUAGE plpgsql;
            """,
            reverse_sql=migrations.RunSQL.noop,
        )
    ]

