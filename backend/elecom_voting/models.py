from django.db import models


class Vote(models.Model):
    student_id = models.CharField(max_length=64)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "votes"
        indexes = [
            models.Index(fields=["student_id", "created_at"]),
        ]


class VoteItem(models.Model):
    vote = models.ForeignKey(Vote, on_delete=models.CASCADE, related_name="items")
    position = models.CharField(max_length=128)
    candidate_id = models.BigIntegerField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "vote_items"
        constraints = [
            models.UniqueConstraint(fields=["vote", "position"], name="ux_vote_items_vote_position"),
        ]
        indexes = [
            models.Index(fields=["position"]),
            models.Index(fields=["candidate_id"]),
        ]
