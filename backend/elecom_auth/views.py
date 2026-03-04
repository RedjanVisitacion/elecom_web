import json

from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from .models import ElecomProfile


def _cors_json(data, *, status=200):
    res = JsonResponse(data, status=status)
    res["Access-Control-Allow-Origin"] = "*"
    res["Access-Control-Allow-Methods"] = "POST, OPTIONS"
    res["Access-Control-Allow-Headers"] = "Content-Type"
    return res


@csrf_exempt
@require_http_methods(["POST", "OPTIONS"])
def api_login(request):
    if request.method == "OPTIONS":
        return _cors_json({"ok": True})

    try:
        payload = json.loads(request.body.decode("utf-8") or "{}")
    except json.JSONDecodeError:
        return _cors_json({"ok": False, "error": "Invalid JSON."}, status=400)

    username = (payload.get("studentId") or payload.get("username") or "").strip()
    password = payload.get("password") or ""

    if not username or not password:
        return _cors_json({"ok": False, "error": "Missing credentials."}, status=400)

    user = authenticate(request, username=username, password=password)
    if user is None:
        return _cors_json({"ok": False, "error": "Invalid credentials."}, status=401)

    login(request, user)

    role = None
    try:
        role = user.elecom_profile.role
    except ElecomProfile.DoesNotExist:
        role = "admin" if (user.is_staff or user.is_superuser) else "student"

    return _cors_json({"ok": True, "username": user.username, "role": role})


@csrf_exempt
@require_http_methods(["POST", "OPTIONS"])
def api_logout(request):
    if request.method == "OPTIONS":
        return _cors_json({"ok": True})

    logout(request)
    return _cors_json({"ok": True})


@login_required
def dashboard_view(request):
    return JsonResponse({"ok": True, "username": request.user.username})
