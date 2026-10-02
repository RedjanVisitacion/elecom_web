from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('elecom_voting', '0013_elevote_chat_messages'),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
            CREATE TABLE IF NOT EXISTS election_calendar_events (
                id          SERIAL PRIMARY KEY,
                title       VARCHAR(255) NOT NULL,
                event_date  DATE NOT NULL,
                end_date    DATE,
                start_time  TIME,
                end_time    TIME,
                description TEXT,
                location    VARCHAR(255),
                color       VARCHAR(32) DEFAULT '#1D4ED8',
                created_at  TIMESTAMPTZ DEFAULT NOW(),
                updated_at  TIMESTAMPTZ DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_cal_events_date ON election_calendar_events(event_date);
            """,
            reverse_sql="DROP TABLE IF EXISTS election_calendar_events;",
        ),
    ]
