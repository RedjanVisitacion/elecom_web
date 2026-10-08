"""Recreate filing schema without deleting surviving COC archives."""
from django.db import connection, transaction
from .candidate_certificates import SCHEMA_SQL as ARCHIVE_SQL
from .coc_management import SCHEMA_SQL as MANAGEMENT_SQL

APPLICATION_SQL = """
            CREATE TABLE IF NOT EXISTS candidate_applications (
                id SERIAL PRIMARY KEY,
                election_id INTEGER NULL,
                student_id VARCHAR(64) NOT NULL,
                first_name VARCHAR(255) NOT NULL,
                middle_name VARCHAR(255) DEFAULT '',
                last_name VARCHAR(255) NOT NULL,
                organization VARCHAR(255) NOT NULL,
                position VARCHAR(255) NOT NULL,
                program VARCHAR(255) NOT NULL,
                year_section VARCHAR(255) NOT NULL,
                platform TEXT NOT NULL,
                candidate_type VARCHAR(64) DEFAULT 'Independent',
                party_name VARCHAR(255) NULL,
                party_code_hash VARCHAR(128) NULL,
                party_code VARCHAR(32) NULL,
                photo_url TEXT NOT NULL,
                photo_public_id VARCHAR(255) NULL,
                party_logo_url TEXT NULL,
                party_logo_public_id VARCHAR(255) NULL,
                requirements_photo_url TEXT NULL,
                requirements_photo_public_id VARCHAR(255) NULL,
                enrollment_certificate_url TEXT NULL,
                enrollment_certificate_public_id VARCHAR(255) NULL,
                grades_url TEXT NULL,
                grades_public_id VARCHAR(255) NULL,
                good_moral_url TEXT NULL,
                good_moral_public_id VARCHAR(255) NULL,
                requirements_submitted_at TIMESTAMP NULL,
                status VARCHAR(32) NOT NULL DEFAULT 'pending',
                reviewed_by VARCHAR(64) NULL,
                reviewed_at TIMESTAMP NULL,
                rejection_reason TEXT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
TABLES = ('candidate_applications', 'candidate_application_certificates',
          'candidate_certificate_settings', 'candidate_certificate_issuances',
          'candidate_certificate_finalizations')
CHILDREN = ('candidate_application_certificates', 'candidate_certificate_issuances',
            'candidate_certificate_finalizations')
FINAL_SQL = """
ALTER TABLE candidate_certificate_settings ADD COLUMN IF NOT EXISTS chairperson_signature_bytes BYTEA NULL;
CREATE TABLE IF NOT EXISTS candidate_certificate_finalizations (
 application_id INTEGER PRIMARY KEY REFERENCES candidate_applications(id) ON DELETE RESTRICT,
 pdf_bytes BYTEA NOT NULL, sha256 VARCHAR(64) NOT NULL, signature_bytes BYTEA NOT NULL,
 settings_snapshot JSONB NOT NULL, final_approved_at TIMESTAMP WITH TIME ZONE NOT NULL,
 CONSTRAINT final_coc_size CHECK (octet_length(pdf_bytes) BETWEEN 1 AND 8388608)
);
"""

def ensure_candidate_filing_schema(force=False):
    with connection.cursor() as cur:
        cur.execute("SELECT to_regclass('public.' || name) IS NOT NULL FROM unnest(%s::text[]) AS name", [list(TABLES)])
        exists = [row[0] for row in cur.fetchall()]
        if all(exists) and not force:
            cur.execute("""SELECT EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema='public' AND table_name='candidate_certificate_settings'
                AND column_name='chairperson_signature_bytes'),
                (SELECT COUNT(DISTINCT conrelid) FROM pg_constraint WHERE contype='f'
                 AND confrelid='public.candidate_applications'::regclass
                 AND conrelid IN ('public.candidate_application_certificates'::regclass,
                   'public.candidate_certificate_issuances'::regclass,
                   'public.candidate_certificate_finalizations'::regclass))""")
            signature, references = cur.fetchone()
            if signature and references == 3:
                return False
    with transaction.atomic(), connection.cursor() as cur:
        cur.execute('SELECT pg_advisory_xact_lock(20261009, 1101)')
        cur.execute(APPLICATION_SQL)
        cur.execute('CREATE INDEX IF NOT EXISTS ix_candidate_applications_status ON candidate_applications(status)')
        cur.execute('CREATE INDEX IF NOT EXISTS ix_candidate_applications_student ON candidate_applications(student_id)')
        cur.execute('CREATE INDEX IF NOT EXISTS ix_candidate_applications_election ON candidate_applications(COALESCE(election_id, 0))')
        cur.execute("CREATE UNIQUE INDEX IF NOT EXISTS ux_candidate_applications_pending ON candidate_applications(COALESCE(election_id, 0), student_id, position) WHERE status='pending'")
        cur.execute(ARCHIVE_SQL)
        cur.execute(MANAGEMENT_SQL)
        cur.execute(FINAL_SQL)
        for table in CHILDREN:
            cur.execute("""SELECT 1 FROM pg_constraint WHERE contype='f'
                AND conrelid=%s::regclass AND confrelid='public.candidate_applications'::regclass""", ['public.' + table])
            if not cur.fetchone():
                # Keep orphaned archives for backup recovery, but enforce future writes.
                cur.execute(f'ALTER TABLE public.{table} ADD CONSTRAINT {table}_application_id_fkey '
                            'FOREIGN KEY (application_id) REFERENCES public.candidate_applications(id) '
                            'ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED NOT VALID')
        # Never reuse application IDs retained in surviving original/issued/final PDFs.
        cur.execute("""SELECT COALESCE(MAX(id), 0) FROM (
            SELECT id FROM candidate_applications UNION ALL
            SELECT application_id FROM candidate_application_certificates UNION ALL
            SELECT application_id FROM candidate_certificate_issuances UNION ALL
            SELECT application_id FROM candidate_certificate_finalizations) ids""")
        maximum = cur.fetchone()[0]
        cur.execute("SELECT pg_get_serial_sequence('public.candidate_applications', 'id')")
        sequence = cur.fetchone()[0]
        if sequence and maximum:
            cur.execute('SELECT pg_sequence_last_value(%s::regclass)', [sequence])
            previous = cur.fetchone()[0] or 0
            if maximum > previous:
                cur.execute('SELECT setval(%s::regclass, %s, true)', [sequence, maximum])
    return True
