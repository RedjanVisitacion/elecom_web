"""Authenticated device registration and durable candidate-filing push delivery."""
from datetime import timedelta
import json
import logging

from django.db import connection, transaction
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

logger = logging.getLogger(__name__)


def _token_request(request):
    student = str(request.session.get("student_id") or "").strip()
    if not student:
        return None, None, JsonResponse({"ok": False, "error": "Unauthorized."}, status=401)
    try:
        data = json.loads(request.body or b"{}")
        token = data.get("token")
        if not isinstance(token, str) or not token.strip() or len(token) > 4096:
            raise ValueError()
    except (ValueError, AttributeError, UnicodeDecodeError):
        return None, None, JsonResponse({"ok": False, "error": "A valid push token is required."}, status=400)
    return student, token.strip(), None


@csrf_exempt
@require_http_methods(["POST"])
def register_push_token_api(request):
    student, token, error = _token_request(request)
    if error is not None:
        return error
    with connection.cursor() as cur:
        # One installation belongs only to its currently authenticated account.
        cur.execute("""
            INSERT INTO mobile_push_tokens (token, student_id, updated_at)
            VALUES (%s, %s, NOW())
            ON CONFLICT (token) DO UPDATE
            SET student_id = EXCLUDED.student_id, updated_at = NOW()
        """, [token, student])
    return JsonResponse({"ok": True})


@csrf_exempt
@require_http_methods(["POST"])
def unregister_push_token_api(request):
    student, token, error = _token_request(request)
    if error is not None:
        return error
    with connection.cursor() as cur:
        cur.execute("DELETE FROM mobile_push_tokens WHERE token = %s AND student_id = %s", [token, student])
    return JsonResponse({"ok": True})


def queue_candidate_push(*, notification_id, student_id, title, body):
    """Called in the filing transaction; never notify about rolled-back decisions."""
    with connection.cursor() as cur:
        cur.execute("""
            INSERT INTO candidate_push_outbox (notification_id, student_id, title, body)
            VALUES (%s, %s, %s, %s) ON CONFLICT (notification_id) DO NOTHING
        """, [notification_id, student_id, title, body])
    transaction.on_commit(lambda: _try_delivery(notification_id))


def _try_delivery(notification_id):
    try:
        deliver_candidate_push(notification_id)
    except Exception:
        # In-app notifications and admin decisions succeed even if FCM is unavailable.
        logger.warning("Candidate push delivery deferred for notification %s", notification_id)


def _messaging():
    import firebase_admin
    from firebase_admin import messaging
    try:
        firebase_admin.get_app()
    except ValueError:
        firebase_admin.initialize_app(options={"httpTimeout": 10})
    return messaging


def deliver_candidate_push(notification_id):
    """Lock an outbox item so cron and the immediate sender cannot duplicate it."""
    with transaction.atomic():
        with connection.cursor() as cur:
            cur.execute("""
                SELECT student_id, title, body, delivered_tokens
                FROM candidate_push_outbox
                WHERE notification_id = %s AND sent_at IS NULL
                  AND created_at > NOW() - INTERVAL '7 days'
                FOR UPDATE SKIP LOCKED
            """, [notification_id])
            row = cur.fetchone()
            if row is None:
                return False
            student, title, body, delivered = row
            delivered = set(delivered or [])
            cur.execute("SELECT token FROM mobile_push_tokens WHERE student_id = %s", [student])
            tokens = [r[0] for r in cur.fetchall() if r[0] not in delivered]
            if not tokens:
                # Do not replay old alerts onto a device registered later.
                cur.execute("UPDATE candidate_push_outbox SET sent_at = NOW() WHERE notification_id = %s", [notification_id])
                return True
            messaging = _messaging()
            failures = False
            for offset in range(0, len(tokens), 500):
                batch = tokens[offset:offset + 500]
                message = messaging.MulticastMessage(
                    tokens=batch,
                    data={"notification_id": str(notification_id), "student_id": str(student),
                          "type": "candidate_filing", "title": title, "body": body},
                    android=messaging.AndroidConfig(priority="high", ttl=timedelta(days=1)),
                )
                result = messaging.send_each_for_multicast(message)
                for token, response in zip(batch, result.responses):
                    if response.success:
                        delivered.add(token)
                    elif isinstance(response.exception, messaging.UnregisteredError):
                        cur.execute("DELETE FROM mobile_push_tokens WHERE token = %s AND student_id = %s", [token, student])
                    else:
                        failures = True
            cur.execute("""
                UPDATE candidate_push_outbox SET delivered_tokens = %s,
                    attempts = attempts + 1, sent_at = %s
                WHERE notification_id = %s
            """, [list(delivered), None if failures else timezone.now(), notification_id])
            return not failures


def deliver_pending_candidate_pushes(limit=100):
    with connection.cursor() as cur:
        cur.execute("""
            SELECT notification_id FROM candidate_push_outbox
            WHERE sent_at IS NULL AND created_at > NOW() - INTERVAL '7 days'
            ORDER BY created_at LIMIT %s
        """, [limit])
        ids = [row[0] for row in cur.fetchall()]
    for notification_id in ids:
        _try_delivery(notification_id)
    return len(ids)
