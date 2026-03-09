from django.db import models


class ElecomStudent(models.Model):
    id_number = models.BigIntegerField(primary_key=True)
    first_name = models.CharField(max_length=255)
    middle_name = models.CharField(max_length=255)
    last_name = models.CharField(max_length=255)
    course = models.CharField(max_length=255)
    year = models.IntegerField()
    section = models.CharField(max_length=255)
    email = models.CharField(max_length=255)
    phone_number = models.CharField(max_length=255)
    role = models.CharField(max_length=255)

    class Meta:
        managed = False
        db_table = "student"


class ElecomUser(models.Model):
    id = models.BigIntegerField(primary_key=True)
    student_id = models.CharField(max_length=64, null=True, blank=True)
    password_hash = models.CharField(max_length=255)
    created_at = models.DateTimeField()
    role = models.CharField(max_length=32)
    department = models.CharField(max_length=128, null=True, blank=True)
    year_level = models.PositiveSmallIntegerField(null=True, blank=True)
    section = models.CharField(max_length=50, null=True, blank=True)
    position = models.CharField(max_length=128, null=True, blank=True)
    phone = models.CharField(max_length=32, null=True, blank=True)
    email = models.CharField(max_length=255, null=True, blank=True)
    otp_code = models.CharField(max_length=255, null=True, blank=True)
    otp_expires_at = models.DateTimeField(null=True, blank=True)
    terms_accepted_at = models.DateTimeField(null=True, blank=True)
    first_name = models.CharField(max_length=128, null=True, blank=True)
    middle_name = models.CharField(max_length=128, null=True, blank=True)
    last_name = models.CharField(max_length=128, null=True, blank=True)

    class Meta:
        managed = False
        db_table = "users"
