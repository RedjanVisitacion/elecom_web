"""
Add face_encoding column to face_enrollments.

Stores the 128-dimensional dlib face embedding as a JSON array so the system
can verify voters locally using face_recognition without calling Face++ API.
"""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("elecom_voting", "0015_calendar_events_add_times"),
    ]

    operations = [
        migrations.AddField(
            model_name="faceenrollment",
            name="face_encoding",
            field=models.TextField(
                blank=True,
                null=True,
                help_text="128-d face embedding (JSON array) from face_recognition/dlib.",
            ),
        ),
    ]
