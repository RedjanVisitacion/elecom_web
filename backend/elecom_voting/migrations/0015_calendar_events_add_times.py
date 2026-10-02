from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('elecom_voting', '0014_election_calendar_events'),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
            ALTER TABLE election_calendar_events
                ADD COLUMN IF NOT EXISTS start_time TIME,
                ADD COLUMN IF NOT EXISTS end_time   TIME;
            """,
            reverse_sql="""
            ALTER TABLE election_calendar_events
                DROP COLUMN IF EXISTS start_time,
                DROP COLUMN IF EXISTS end_time;
            """,
        ),
    ]
