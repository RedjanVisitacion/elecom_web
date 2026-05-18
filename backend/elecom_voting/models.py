from django.db import models


class Vote(models.Model):
    student_id = models.CharField(max_length=64)
    election_id = models.BigIntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "votes"
        indexes = [
            models.Index(fields=["student_id", "created_at"], name="votes_student_50c58f_idx"),
            models.Index(fields=["election_id", "student_id"], name="votes_electio_50a328_idx"),
        ]


class VoteItem(models.Model):
    vote = models.ForeignKey(Vote, on_delete=models.CASCADE, related_name="items")
    position = models.CharField(max_length=128)
    candidate_id = models.BigIntegerField()
    election_id = models.BigIntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "vote_items"
        constraints = [
            models.UniqueConstraint(fields=["vote", "position", "candidate_id"], name="ux_vote_items_vote_position_candidate"),
        ]
        indexes = [
            models.Index(fields=["position"], name="vote_items_positio_a23bbb_idx"),
            models.Index(fields=["candidate_id"], name="vote_items_candida_645f6c_idx"),
            models.Index(fields=["election_id", "candidate_id"], name="vote_items_electio_209f9b_idx"),
        ]


class AppRating(models.Model):
    student_id = models.CharField(max_length=64)
    rating = models.PositiveSmallIntegerField()
    label = models.CharField(max_length=32)
    ip_address = models.CharField(max_length=64, null=True, blank=True)
    user_agent = models.CharField(max_length=512, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "app_ratings"
        indexes = [
            models.Index(fields=["student_id", "created_at"], name="app_ratings_student_373ec1_idx"),
            models.Index(fields=["rating"], name="app_ratings_rating_b76a4c_idx"),
        ]


class MobileTutorialState(models.Model):
    student_id = models.CharField(max_length=64, unique=True)
    login_done = models.BooleanField(default=False)
    home_done = models.BooleanField(default=False)
    voting_done = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "mobile_tutorial_state"
        indexes = [
            models.Index(fields=["student_id"], name="mobile_tuto_student_607a10_idx"),
            models.Index(fields=["updated_at"], name="mobile_tuto_updated_61d84a_idx"),
        ]


class FaceEnrollment(models.Model):
    user_id = models.BigIntegerField(null=True, blank=True)
    student_id = models.CharField(max_length=64)
    face_image_url = models.TextField()
    cloudinary_public_id = models.CharField(max_length=255)
    facepp_face_token = models.CharField(max_length=64, null=True, blank=True)
    enrollment_status = models.CharField(max_length=32, default="active")
    enrolled_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "face_enrollments"
        indexes = [
            models.Index(fields=["student_id", "enrollment_status"], name="face_enroll_student_5caf69_idx"),
            models.Index(fields=["enrolled_at"], name="face_enroll_enrolle_520352_idx"),
        ]


class FaceVerificationLog(models.Model):
    student_id = models.CharField(max_length=64)
    election_id = models.BigIntegerField(null=True, blank=True)
    liveness_status = models.CharField(max_length=32)
    verification_status = models.CharField(max_length=32)
    match_score = models.DecimalField(max_digits=10, decimal_places=4, null=True, blank=True)
    failure_reason = models.TextField(null=True, blank=True)
    verified_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "face_verification_logs"
        indexes = [
            models.Index(fields=["student_id", "verified_at"], name="face_verifi_student_a3d32a_idx"),
            models.Index(fields=["election_id", "verified_at"], name="face_verifi_electio_28cedc_idx"),
            models.Index(fields=["verification_status"], name="face_verifi_verific_8f29c6_idx"),
        ]
