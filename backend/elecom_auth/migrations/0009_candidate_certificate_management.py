from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [('elecom_auth', '0008_candidate_application_certificates')]
    operations = [migrations.RunSQL(
        sql="""
CREATE TABLE IF NOT EXISTS candidate_certificate_settings (
    election_id INTEGER NOT NULL,
    form_kind VARCHAR(16) NOT NULL CHECK (form_kind IN ('usg', 'department')),
    academic_year_start INTEGER NOT NULL CHECK (academic_year_start BETWEEN 1900 AND 2200),
    academic_year_end INTEGER NOT NULL CHECK (academic_year_end = academic_year_start + 1),
    chairperson_name VARCHAR(120) NOT NULL,
    updated_by VARCHAR(64) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (election_id, form_kind)
);
CREATE TABLE IF NOT EXISTS candidate_certificate_issuances (
    application_id INTEGER PRIMARY KEY REFERENCES candidate_applications(id) ON DELETE RESTRICT,
    pdf_bytes BYTEA NOT NULL,
    sha256 VARCHAR(64) NOT NULL,
    settings_snapshot JSONB NOT NULL,
    initial_approved_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT issued_coc_size CHECK (octet_length(pdf_bytes) BETWEEN 1 AND 8388608)
);
""",
        reverse_sql=migrations.RunSQL.noop,
    )]
