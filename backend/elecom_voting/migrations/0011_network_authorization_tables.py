from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("elecom_voting", "0010_mobile_tutorial_state"),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
            CREATE TABLE IF NOT EXISTS authorized_networks (
                id SERIAL PRIMARY KEY,
                network_ip INET NOT NULL,
                ip_prefix VARCHAR(100),
                ssid VARCHAR(100),
                status VARCHAR(20) DEFAULT 'Active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS network_access_attempts (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NULL,
                student_id VARCHAR(50),
                ip_address INET NOT NULL,
                ssid VARCHAR(100),
                status VARCHAR(20),
                message TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE INDEX IF NOT EXISTS authorized_networks_status_idx
            ON authorized_networks (status);

            CREATE INDEX IF NOT EXISTS network_access_attempts_created_at_idx
            ON network_access_attempts (created_at DESC);
            """,
            reverse_sql=migrations.RunSQL.noop,
        )
    ]
