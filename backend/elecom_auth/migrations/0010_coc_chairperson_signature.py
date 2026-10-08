from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [('elecom_auth', '0009_candidate_certificate_management')]
    operations = [migrations.RunSQL(sql="""
ALTER TABLE candidate_certificate_settings ADD COLUMN IF NOT EXISTS chairperson_signature_bytes BYTEA NULL;
CREATE TABLE IF NOT EXISTS candidate_certificate_finalizations (
    application_id INTEGER PRIMARY KEY REFERENCES candidate_applications(id) ON DELETE RESTRICT,
    pdf_bytes BYTEA NOT NULL,
    sha256 VARCHAR(64) NOT NULL,
    signature_bytes BYTEA NOT NULL,
    settings_snapshot JSONB NOT NULL,
    final_approved_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT final_coc_size CHECK (octet_length(pdf_bytes) BETWEEN 1 AND 8388608)
);
""", reverse_sql=migrations.RunSQL.noop)]
