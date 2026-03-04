from django.conf import settings
from django.db import models


class ElecomProfile(models.Model):
    ROLE_ADMIN = "admin"
    ROLE_STUDENT = "student"

    ROLE_CHOICES = [
        (ROLE_ADMIN, "Admin"),
        (ROLE_STUDENT, "Student"),
    ]

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="elecom_profile")
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default=ROLE_STUDENT)

    def __str__(self) -> str:
        return f"{self.user.username} ({self.role})"
