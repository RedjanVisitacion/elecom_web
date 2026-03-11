from __future__ import annotations

import json

from django.http import JsonResponse
from django.shortcuts import render
from django.db import connection
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from elecom_auth.models import ElecomUser


def _verify_password(stored: str, provided: str) -> bool:
    if stored is None:
        return False
    if provided is None:
        return False

    stored = str(stored)
    provided = str(provided)

    if stored.startswith("$2y$") or stored.startswith("$2a$") or stored.startswith("$2b$"):
        import bcrypt

        normalized = stored
        if normalized.startswith("$2y$"):
            normalized = "$2b$" + normalized[4:]

        try:
            return bcrypt.checkpw(provided.encode("utf-8"), normalized.encode("utf-8"))
        except Exception:
            return False

    return stored == provided


@csrf_exempt
@require_http_methods(["GET", "POST"])
def login_view(request):
    if request.method == "GET":
        return render(request, "elecom_login.html")

    student_id = ""
    password = ""

    if request.content_type and "application/json" in request.content_type:
        try:
            payload = json.loads((request.body or b"{}").decode("utf-8"))
        except Exception:
            payload = {}
        student_id = (payload.get("studentId") or payload.get("student_id") or "").strip()
        password = payload.get("password") or ""
    else:
        student_id = (request.POST.get("studentId") or request.POST.get("student_id") or "").strip()
        password = request.POST.get("password") or ""

    if not student_id or not password:
        return JsonResponse({"ok": False, "error": "Missing credentials."}, status=400)

    user = ElecomUser.objects.filter(student_id=student_id).first()
    if not user:
        return JsonResponse({"ok": False, "error": "Invalid credentials."}, status=401)

    if not _verify_password(user.password_hash, password):
        return JsonResponse({"ok": False, "error": "Invalid credentials."}, status=401)

    request.session["student_id"] = user.student_id
    request.session["role"] = user.role

    return JsonResponse({"ok": True, "student_id": user.student_id, "role": user.role})


@require_http_methods(["GET"])
def admin_dashboard_api(request):
    role = (request.session.get("role") or "").lower()
    if role != "admin":
        return JsonResponse({"ok": False, "error": "Forbidden."}, status=403)

    def safe_scalar(sql: str, params=None, default=0):
        try:
            with connection.cursor() as cur:
                cur.execute(sql, params or [])
                row = cur.fetchone()
                if not row:
                    return default
                return row[0] if row[0] is not None else default
        except Exception:
            return default

    total_candidates = safe_scalar("SELECT COUNT(*) FROM candidates_registration", default=0)
    total_voters = safe_scalar("SELECT COUNT(*) FROM users WHERE role = %s", ["student"], default=0)
    total_cast_votes = safe_scalar("SELECT COUNT(*) FROM votes", default=0)
    if not total_cast_votes:
        total_cast_votes = safe_scalar("SELECT COUNT(DISTINCT voter_id) FROM vote_items", default=0)
    total_not_voted = max(0, int(total_voters) - int(total_cast_votes))

    election = {
        "status": "No schedule",
        "status_class": "secondary",
        "start_at": None,
        "end_at": None,
        "results_at": None,
    }
    try:
        with connection.cursor() as cur:
            cur.execute("SELECT start_at, end_at, results_at FROM vote_windows ORDER BY id DESC LIMIT 1")
            row = cur.fetchone()
        if row:
            start_at, end_at, results_at = row
            election["start_at"] = start_at.isoformat() if start_at else None
            election["end_at"] = end_at.isoformat() if end_at else None
            election["results_at"] = results_at.isoformat() if results_at else None

            if start_at and end_at:
                from django.utils import timezone

                now = timezone.now()
                if now < start_at:
                    election["status"] = "Upcoming"
                    election["status_class"] = "warning"
                elif start_at <= now <= end_at:
                    election["status"] = "Active"
                    election["status_class"] = "success"
                else:
                    election["status"] = "Closed"
                    election["status_class"] = "danger"
    except Exception:
        pass

    recent_votes = []
    try:
        with connection.cursor() as cur:
            cur.execute(
                """
                SELECT v.student_id AS sid, v.created_at AS voted_at,
                       s.first_name, s.middle_name, s.last_name
                FROM votes v
                LEFT JOIN student s ON s.id_number::text = v.student_id::text
                ORDER BY v.created_at DESC
                LIMIT 10
                """
            )
            rows = cur.fetchall()
        for sid, voted_at, first_name, middle_name, last_name in rows:
            full_name = " ".join([p for p in [first_name, middle_name, last_name] if p])
            recent_votes.append(
                {
                    "student_id": str(sid) if sid is not None else "",
                    "name": full_name or (str(sid) if sid is not None else ""),
                    "voted_at": voted_at.isoformat() if voted_at else None,
                }
            )
    except Exception:
        recent_votes = []

    return JsonResponse(
        {
            "ok": True,
            "metrics": {
                "total_candidates": int(total_candidates),
                "total_voters": int(total_voters),
                "total_cast_votes": int(total_cast_votes),
                "total_not_voted": int(total_not_voted),
            },
            "election": election,
            "recent_votes": recent_votes,
        }
    )