from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [('elecom_auth', '0010_coc_chairperson_signature')]
    operations = [migrations.RunSQL(sql="""
ALTER TABLE candidate_certificate_settings ADD COLUMN IF NOT EXISTS name_is_bold BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE candidate_certificate_settings ADD COLUMN IF NOT EXISTS name_is_italic BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE candidate_certificate_settings ADD COLUMN IF NOT EXISTS year_is_bold BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE candidate_certificate_settings ADD COLUMN IF NOT EXISTS year_is_italic BOOLEAN NOT NULL DEFAULT FALSE;
""", reverse_sql=migrations.RunSQL.noop)]
