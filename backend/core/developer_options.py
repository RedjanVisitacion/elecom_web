"""Password-gated administrator account management."""
import json
import logging
from datetime import timedelta

from django.db import connection, transaction
from django.http import JsonResponse
from django.middleware.csrf import get_token
from django.utils import timezone
from django.views.decorators.http import require_http_methods

logger = logging.getLogger(__name__)

def _developer_admin(request):
    from .views import _require_admin
    denied = _require_admin(request)
    if denied is not None:
        return denied
    try:
        verified = timezone.datetime.fromisoformat(request.session.get("developer_access_verified_at", ""))
        age = timezone.now() - verified
        if age < timedelta(0) or age > timedelta(minutes=15):
            raise ValueError
    except (ValueError, TypeError):
        return JsonResponse({"ok": False, "error": "Open Developer Options again and verify your admin password."}, status=403)
    identity = str(request.session.get("student_id") or "")
    with connection.cursor() as cur:
        cur.execute("""SELECT id FROM users WHERE (student_id::text = %s OR id::text = %s)
                       AND LOWER(TRIM(role)) = 'admin'""", [identity, identity])
        if not identity or cur.fetchone() is None:
            return JsonResponse({"ok": False, "error": "Administrator access is required."}, status=403)
    return None


@require_http_methods(["GET", "POST"])
def developer_users_api(request):
    denied = _developer_admin(request)
    if denied is not None:
        return denied
    if request.method == "GET":
        try:
            page = max(1, int(request.GET.get("page", "1")))
        except ValueError:
            return JsonResponse({"ok": False, "error": "Invalid page."}, status=400)
        query = str(request.GET.get("q") or "").strip()
        like = '%' + query.replace('\\', '\\\\').replace('%', '\\%').replace('_', '\\_') + '%'
        with connection.cursor() as cur:
            cur.execute("""
                SELECT u.id, u.student_id,
                       COALESCE(NULLIF(u.first_name, ''), s.first_name, ''),
                       COALESCE(NULLIF(u.middle_name, ''), s.middle_name, ''),
                       COALESCE(NULLIF(u.last_name, ''), s.last_name, ''),
                       u.email, u.role
                FROM users u LEFT JOIN student s ON s.id_number::text = u.student_id::text
                WHERE CONCAT_WS(' ', u.student_id, u.first_name, u.middle_name, u.last_name,
                                s.first_name, s.middle_name, s.last_name, u.email, u.role) ILIKE %s
                ORDER BY u.id LIMIT 101 OFFSET %s
            """, [like, (page - 1) * 100])
            rows = cur.fetchall()
        users = [dict(zip(('id', 'student_id', 'first_name', 'middle_name', 'last_name', 'email', 'role'), row)) for row in rows[:100]]
        return JsonResponse({"ok": True, "users": users, "page": page, "has_more": len(rows) > 100, "csrf_token": get_token(request)})
    try:
        data = json.loads(request.body)
        user_id = int(data['id'])
        role = data.get('role')
        if role not in {'admin', 'student'} or user_id <= 0:
            raise ValueError
    except (ValueError, TypeError, KeyError, AttributeError, UnicodeDecodeError):
        return JsonResponse({"ok": False, "error": "Select a valid account and role."}, status=400)
    with transaction.atomic():
        with connection.cursor() as cur:
            # Serialize role changes, including other user-management endpoints.
            cur.execute("LOCK TABLE users IN SHARE ROW EXCLUSIVE MODE")
            denied = _developer_admin(request)
            if denied is not None:
                return denied
            cur.execute("SELECT role FROM users WHERE id = %s FOR UPDATE", [user_id])
            target = cur.fetchone()
            if target is None:
                return JsonResponse({"ok": False, "error": "Account not found."}, status=404)
            if role == 'student' and str(target[0]).strip().lower() == 'admin':
                cur.execute("SELECT COUNT(*) FROM users WHERE LOWER(TRIM(role)) = 'admin'")
                if cur.fetchone()[0] <= 1:
                    return JsonResponse({"ok": False, "error": "The last administrator cannot be removed."}, status=409)
            cur.execute("UPDATE users SET role = %s WHERE id = %s", [role, user_id])
    logger.info("Admin %s changed user %s role to %s", request.session.get("student_id"), user_id, role)
    message = ("Account is now an admin. Sign out and sign in again to access the admin dashboard."
               if role == 'admin' else "Admin access removed. This account is now a student.")
    return JsonResponse({"ok": True, "message": message})
