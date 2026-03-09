from __future__ import annotations

import json

from django.http import JsonResponse
from django.shortcuts import render
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