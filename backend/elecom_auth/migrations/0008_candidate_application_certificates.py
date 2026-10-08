from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [('elecom_auth', '0007_candidate_applications')]
    operations = [migrations.RunSQL(
        sql="""
        CREATE TABLE IF NOT EXISTS candidate_application_certificates (
            application_id INTEGER PRIMARY KEY REFERENCES candidate_applications(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
            pdf_bytes BYTEA NOT NULL,
            signature_bytes BYTEA NOT NULL,
            filing_fields JSONB NOT NULL,
            sha256 VARCHAR(64) NOT NULL,
            template_version VARCHAR(64) NOT NULL DEFAULT 'mobile-coc-v1',
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT candidate_coc_size CHECK (octet_length(pdf_bytes) BETWEEN 1 AND 8388608)
        );
        """,
        reverse_sql=migrations.RunSQL.noop,
    )]
