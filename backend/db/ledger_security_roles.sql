-- Run as a PostgreSQL admin (one-time), then point Django env vars at this role:
--   DB_USER=elecom_backend
--   DB_PASSWORD=<strong password>
--
-- IMPORTANT: do NOT use the postgres superuser for the backend connection.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'elecom_backend') THEN
    CREATE ROLE elecom_backend LOGIN PASSWORD 'CHANGE_ME_STRONG_PASSWORD';
  END IF;
END $$;

-- Allow connection + usage
GRANT CONNECT ON DATABASE elecom_db TO elecom_backend;
GRANT USAGE ON SCHEMA public TO elecom_backend;

-- Ledger tables are append-only for backend: INSERT + SELECT only.
GRANT SELECT, INSERT ON TABLE
  public.votes,
  public.vote_items,
  public.vote_blocks,
  public.block_validations
TO elecom_backend;

-- If you still run ledger backfill, allow updating ONLY the status column.
GRANT UPDATE (block_status) ON TABLE public.vote_blocks TO elecom_backend;

-- Validators + schedule + candidates need reads; writes are typically admin-only.
GRANT SELECT ON TABLE
  public.validator_nodes,
  public.vote_windows,
  public.candidates_registration
TO elecom_backend;

-- Audit log inserts (backend writes events)
GRANT INSERT, SELECT ON TABLE public.audit_logs TO elecom_backend;

-- If your backend inserts into these tables and they use BIGSERIAL:
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO elecom_backend;

-- Explicitly revoke dangerous privileges
REVOKE ALL ON DATABASE elecom_db FROM elecom_backend;
GRANT CONNECT ON DATABASE elecom_db TO elecom_backend;
REVOKE CREATE ON SCHEMA public FROM elecom_backend;

-- Defense-in-depth: ensure no UPDATE/DELETE/TRUNCATE on protected ledger tables
REVOKE UPDATE, DELETE, TRUNCATE ON TABLE
  public.votes,
  public.vote_items,
  public.vote_blocks,
  public.block_validations
FROM elecom_backend;

