from django.db import migrations

class Migration(migrations.Migration):
    dependencies = [("elecom_voting", "0018_election_mobile_appearance")]
    operations = [migrations.RunSQL(
        sql="ALTER TABLE election_mobile_appearance ADD COLUMN IF NOT EXISTS slides JSONB NULL",
        reverse_sql=migrations.RunSQL.noop,
    )]
