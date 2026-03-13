from __future__ import annotations

import json

from django.http import JsonResponse
from django.shortcuts import render
from django.db import connection
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from django.conf import settings

from elecom_auth.models import ElecomUser


def _verify_password(stored: str, provided: str) -> bool:
    if stored is None:
        return False
    if provided is None:
        return False

    stored = str(stored).strip()
    provided = str(provided).strip()

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
def account_profile_api(request):
    student_id = (request.session.get("student_id") or "").strip()
    if not student_id:
        return JsonResponse({"ok": False, "error": "Unauthorized."}, status=401)

    user_row = None
    try:
        with connection.cursor() as cur:
            try:
                cur.execute(
                    """
                    SELECT id, student_id, role, created_at,
                           department, year_level, section, position,
                           phone, email,
                           first_name, middle_name, last_name,
                           photo_url
                    FROM users
                    WHERE student_id::text = %s
                    ORDER BY id DESC
                    LIMIT 1
                    """,
                    [student_id],
                )
            except Exception:
                cur.execute(
                    """
                    SELECT id, student_id, role, created_at,
                           department, year_level, section, position,
                           phone, email,
                           first_name, middle_name, last_name
                    FROM users
                    WHERE student_id::text = %s
                    ORDER BY id DESC
                    LIMIT 1
                    """,
                    [student_id],
                )
            row = cur.fetchone()
            if row:
                cols = [c[0] for c in cur.description]
                user_row = dict(zip(cols, row))
    except Exception as e:
        if getattr(settings, "DEBUG", False):
            return JsonResponse({"ok": False, "error": str(e)}, status=500)
        return JsonResponse({"ok": False, "error": "Failed to load user."}, status=500)

    student_row = None
    try:
        with connection.cursor() as cur:
            cur.execute(
                """
                SELECT id_number, first_name, middle_name, last_name,
                       course, year, section, email, phone_number, role
                FROM student
                WHERE id_number::text = %s
                LIMIT 1
                """,
                [student_id],
            )
            row = cur.fetchone()
            if row:
                cols = [c[0] for c in cur.description]
                student_row = dict(zip(cols, row))
    except Exception as e:
        if getattr(settings, "DEBUG", False):
            return JsonResponse({"ok": False, "error": str(e)}, status=500)
        return JsonResponse({"ok": False, "error": "Failed to load student."}, status=500)

    return JsonResponse(
        {
            "ok": True,
            "student_id": student_id,
            "user": user_row,
            "student": student_row,
        }
    )


@csrf_exempt
@require_http_methods(["POST"])
def account_profile_photo_api(request):
    student_id = (request.session.get("student_id") or "").strip()
    if not student_id:
        return JsonResponse({"ok": False, "error": "Unauthorized."}, status=401)

    try:
        payload = json.loads((request.body or b"{}").decode("utf-8"))
    except Exception:
        payload = {}

    photo_url = str(payload.get("photo_url") or "").strip() or None

    if photo_url is not None and len(photo_url) > 2000:
        return JsonResponse({"ok": False, "error": "Invalid photo URL."}, status=400)

    try:
        with connection.cursor() as cur:
            cur.execute(
                """
                UPDATE users
                SET photo_url = %s
                WHERE student_id::text = %s
                """,
                [photo_url, student_id],
            )
        return JsonResponse({"ok": True, "photo_url": photo_url})
    except Exception as e:
        msg = str(e) or "Failed to update profile photo."
        if "photo_url" in msg and "does not exist" in msg:
            return JsonResponse(
                {
                    "ok": False,
                    "error": "Missing column users.photo_url. Add it in the database then retry.",
                },
                status=500,
            )
        if getattr(settings, "DEBUG", False):
            return JsonResponse({"ok": False, "error": msg}, status=500)
        return JsonResponse({"ok": False, "error": "Failed to update profile photo."}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def account_profile_update_api(request):
    student_id = (request.session.get("student_id") or "").strip()
    if not student_id:
        return JsonResponse({"ok": False, "error": "Unauthorized."}, status=401)

    try:
        payload = json.loads((request.body or b"{}").decode("utf-8"))
    except Exception:
        payload = {}

    email = str(payload.get("email") or "").strip() or None
    phone = str(payload.get("phone") or payload.get("phone_number") or "").strip() or None

    if email is not None and len(email) > 255:
        return JsonResponse({"ok": False, "error": "Invalid email."}, status=400)
    if phone is not None and len(phone) > 32:
        return JsonResponse({"ok": False, "error": "Invalid phone."}, status=400)

    try:
        with connection.cursor() as cur:
            cur.execute(
                """
                UPDATE users
                SET email = %s,
                    phone = %s
                WHERE student_id::text = %s
                """,
                [email, phone, student_id],
            )

            # Keep student table in sync if present.
            try:
                cur.execute(
                    """
                    UPDATE student
                    SET email = %s,
                        phone_number = %s
                    WHERE id_number::text = %s
                    """,
                    [email, phone, student_id],
                )
            except Exception:
                pass

        return JsonResponse({"ok": True, "email": email, "phone": phone})
    except Exception as e:
        if getattr(settings, "DEBUG", False):
            return JsonResponse({"ok": False, "error": str(e)}, status=500)
        return JsonResponse({"ok": False, "error": "Failed to update profile."}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def account_profile_password_api(request):
    student_id = (request.session.get("student_id") or "").strip()
    if not student_id:
        return JsonResponse({"ok": False, "error": "Unauthorized."}, status=401)

    try:
        payload = json.loads((request.body or b"{}").decode("utf-8"))
    except Exception:
        payload = {}

    old_password = str(payload.get("old_password") or payload.get("oldPassword") or "")
    new_password = str(payload.get("new_password") or payload.get("newPassword") or "")
    confirm_password = str(payload.get("confirm_password") or payload.get("confirmPassword") or "")

    if not old_password or not new_password or not confirm_password:
        return JsonResponse({"ok": False, "error": "Missing fields."}, status=400)
    if new_password != confirm_password:
        return JsonResponse({"ok": False, "error": "Passwords do not match."}, status=400)
    if len(new_password) < 6:
        return JsonResponse({"ok": False, "error": "Password must be at least 6 characters."}, status=400)

    try:
        stored_hash = None
        with connection.cursor() as cur:
            cur.execute(
                """
                SELECT password_hash
                FROM users
                WHERE student_id::text = %s
                ORDER BY id DESC
                LIMIT 1
                """,
                [student_id],
            )
            row = cur.fetchone()
            if row:
                stored_hash = row[0]

        if not stored_hash:
            return JsonResponse({"ok": False, "error": "User not found."}, status=404)

        if not _verify_password(str(stored_hash), old_password):
            return JsonResponse({"ok": False, "error": "Old password is incorrect."}, status=400)

        import bcrypt

        hashed = bcrypt.hashpw(new_password.encode("utf-8"), bcrypt.gensalt())
        hashed_str = hashed.decode("utf-8")

        with connection.cursor() as cur:
            cur.execute(
                """
                UPDATE users
                SET password_hash = %s
                WHERE student_id::text = %s
                """,
                [hashed_str, student_id],
            )

        return JsonResponse({"ok": True})
    except Exception as e:
        if getattr(settings, "DEBUG", False):
            return JsonResponse({"ok": False, "error": str(e)}, status=500)
        return JsonResponse({"ok": False, "error": "Failed to change password."}, status=500)


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
                if timezone.is_naive(start_at):
                    start_at = timezone.make_aware(start_at, timezone.get_current_timezone())
                if timezone.is_naive(end_at):
                    end_at = timezone.make_aware(end_at, timezone.get_current_timezone())

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


def _require_admin(request):
    role = (request.session.get("role") or "").lower()
    if role != "admin":
        return JsonResponse({"ok": False, "error": "Forbidden."}, status=403)
    return None


@require_http_methods(["GET"])
def admin_cloudinary_signature_api(request):
    forbidden = _require_admin(request)
    if forbidden:
        return forbidden

    cloud_name = getattr(settings, "CLOUDINARY_CLOUD_NAME", "") or ""
    api_key = getattr(settings, "CLOUDINARY_API_KEY", "") or ""
    api_secret = getattr(settings, "CLOUDINARY_API_SECRET", "") or ""

    if not cloud_name or not api_key or not api_secret:
        return JsonResponse(
            {"ok": False, "error": "Cloudinary is not configured."},
            status=500,
        )

    upload_type = (request.GET.get("type") or "").strip() or "candidate_photo"
    folder_map = {
        "candidate_photo": "elecom/candidates/photos",
        "party_logo": "elecom/candidates/party_logos",
        "profile_photo": "elecom/users/photos",
    }
    folder = folder_map.get(upload_type, folder_map["candidate_photo"])

    try:
        import time
        import hashlib

        timestamp = int(time.time())
        # Cloudinary signature base string is sorted params joined with '&'
        params_to_sign = {
            "folder": folder,
            "timestamp": timestamp,
        }
        to_sign = "&".join([f"{k}={params_to_sign[k]}" for k in sorted(params_to_sign.keys())])
        signature = hashlib.sha1((to_sign + api_secret).encode("utf-8")).hexdigest()

        return JsonResponse(
            {
                "ok": True,
                "cloud_name": cloud_name,
                "api_key": api_key,
                "timestamp": timestamp,
                "folder": folder,
                "signature": signature,
            }
        )
    except Exception:
        return JsonResponse(
            {"ok": False, "error": "Failed to generate upload signature."},
            status=500,
        )


@require_http_methods(["GET"])
def admin_candidates_list_api(request):
    forbidden = _require_admin(request)
    if forbidden:
        return forbidden

    q = (request.GET.get("q") or "").strip()

    where = ""
    params = []
    if q:
        where = (
            "WHERE (COALESCE(first_name,'') || ' ' || COALESCE(middle_name,'') || ' ' || COALESCE(last_name,'')) ILIKE %s "
            "OR CAST(student_id AS TEXT) ILIKE %s "
            "OR COALESCE(position,'') ILIKE %s "
            "OR COALESCE(organization,'') ILIKE %s "
            "OR COALESCE(party_name,'') ILIKE %s"
        )
        like = f"%{q}%"
        params = [like, like, like, like, like]

    sql = f"""
        SELECT id, student_id, first_name, middle_name, last_name,
               position, organization, program, year_section,
               photo_url, party_name, candidate_type, party_logo_url
        FROM candidates_registration
        {where}
        ORDER BY party_name, organization, position, last_name, first_name
        LIMIT 500
    """

    try:
        with connection.cursor() as cur:
            cur.execute(sql, params)
            cols = [c[0] for c in cur.description]
            rows = [dict(zip(cols, r)) for r in cur.fetchall()]
        return JsonResponse({"ok": True, "candidates": rows})
    except Exception:
        return JsonResponse({"ok": False, "error": "Failed to load candidates."}, status=500)


@require_http_methods(["GET"])
def admin_candidates_detail_api(request):
    forbidden = _require_admin(request)
    if forbidden:
        return forbidden

    cid = (request.GET.get("id") or "").strip()
    if not cid:
        return JsonResponse({"ok": False, "error": "Missing id."}, status=400)

    try:
        with connection.cursor() as cur:
            cur.execute(
                """
                SELECT id, student_id, first_name, middle_name, last_name,
                       organization, position, program, year_section,
                       platform, candidate_type, party_name, photo_url,
                       party_logo_url
                FROM candidates_registration
                WHERE id = %s
                LIMIT 1
                """,
                [cid],
            )
            row = cur.fetchone()
            if not row:
                return JsonResponse({"ok": False, "error": "Not found."}, status=404)
            cols = [c[0] for c in cur.description]
            candidate = dict(zip(cols, row))
        return JsonResponse({"ok": True, "candidate": candidate})
    except Exception:
        return JsonResponse({"ok": False, "error": "Failed to load candidate."}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def admin_candidates_update_api(request):
    forbidden = _require_admin(request)
    if forbidden:
        return forbidden

    try:
        payload = json.loads((request.body or b"{}").decode("utf-8"))
    except Exception:
        payload = {}

    cid = str(payload.get("id") or "").strip()
    if not cid:
        return JsonResponse({"ok": False, "error": "Missing id."}, status=400)

    fields = {
        "first_name": (payload.get("first_name") or "").strip(),
        "middle_name": (payload.get("middle_name") or "").strip() or None,
        "last_name": (payload.get("last_name") or "").strip(),
        "organization": (payload.get("organization") or "").strip(),
        "position": (payload.get("position") or "").strip(),
        "program": (payload.get("program") or "").strip(),
        "year_section": (payload.get("year_section") or "").strip(),
        "platform": (payload.get("platform") or "").strip(),
        "photo_url": (payload.get("photo_url") or "").strip() or None,
        "party_logo_url": (payload.get("party_logo_url") or "").strip() or None,
    }

    if not fields["first_name"] or not fields["last_name"]:
        return JsonResponse({"ok": False, "error": "Missing required fields."}, status=400)

    try:
        with connection.cursor() as cur:
            cur.execute(
                """
                UPDATE candidates_registration
                SET first_name = %s,
                    middle_name = %s,
                    last_name = %s,
                    organization = %s,
                    position = %s,
                    program = %s,
                    year_section = %s,
                    platform = %s,
                    photo_url = %s,
                    party_logo_url = %s
                WHERE id = %s
                """,
                [
                    fields["first_name"],
                    fields["middle_name"],
                    fields["last_name"],
                    fields["organization"],
                    fields["position"],
                    fields["program"],
                    fields["year_section"],
                    fields["platform"],
                    fields["photo_url"],
                    fields["party_logo_url"],
                    cid,
                ],
            )
        return JsonResponse({"ok": True})
    except Exception as e:
        return JsonResponse({"ok": False, "error": str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def admin_candidates_create_api(request):
    forbidden = _require_admin(request)
    if forbidden:
        return forbidden

    if request.content_type and "application/json" in request.content_type:
        try:
            payload = json.loads((request.body or b"{}").decode("utf-8"))
        except Exception:
            payload = {}
    else:
        payload = {}
        try:
            for k, v in (request.POST or {}).items():
                payload[k] = v
        except Exception:
            payload = {}

    student_id = str(payload.get("student_id") or "").strip()
    first_name = str(payload.get("first_name") or "").strip()
    middle_name = str(payload.get("middle_name") or "").strip() or None
    last_name = str(payload.get("last_name") or "").strip()
    organization = str(payload.get("organization") or "").strip()
    position = str(payload.get("position") or "").strip()
    program = str(payload.get("program") or "").strip()
    year_section = str(payload.get("year_section") or "").strip()
    platform = str(payload.get("platform") or "").strip()
    photo_url = str(payload.get("photo_url") or "").strip() or None
    party_name = str(payload.get("party_name") or "").strip() or None
    candidate_type = str(payload.get("candidate_type") or "").strip() or None
    party_logo_url = str(payload.get("party_logo_url") or "").strip() or None

    if not student_id:
        return JsonResponse({"ok": False, "error": "Student ID is required."}, status=400)
    if not first_name or not last_name:
        return JsonResponse({"ok": False, "error": "First name and Last name are required."}, status=400)
    if not organization or not position:
        return JsonResponse({"ok": False, "error": "Organization and Position are required."}, status=400)
    if not program or not year_section:
        return JsonResponse({"ok": False, "error": "Program and Year/Section are required."}, status=400)
    if not platform:
        return JsonResponse({"ok": False, "error": "Platform is required."}, status=400)

    try:
        with connection.cursor() as cur:
            cur.execute(
                """
                INSERT INTO candidates_registration (
                    student_id, first_name, middle_name, last_name,
                    organization, position, program, year_section,
                    platform, photo_url, party_name, candidate_type, party_logo_url
                )
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                RETURNING id
                """,
                [
                    student_id,
                    first_name,
                    middle_name,
                    last_name,
                    organization,
                    position,
                    program,
                    year_section,
                    platform,
                    photo_url,
                    party_name,
                    candidate_type,
                    party_logo_url,
                ],
            )
            row = cur.fetchone()
        return JsonResponse({"ok": True, "id": int(row[0]) if row else None})
    except Exception as e:
        msg = str(e) or "Failed to register candidate."
        if "ux_candidates_registration_student_position" in msg or "duplicate key" in msg.lower():
            return JsonResponse(
                {"ok": False, "error": "Candidate already registered for this position."},
                status=409,
            )

        if getattr(settings, "DEBUG", False):
            return JsonResponse({"ok": False, "error": msg}, status=500)
        return JsonResponse({"ok": False, "error": "Failed to register candidate."}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def admin_candidates_delete_api(request):
    forbidden = _require_admin(request)
    if forbidden:
        return forbidden

    try:
        payload = json.loads((request.body or b"{}").decode("utf-8"))
    except Exception:
        payload = {}

    cid = str(payload.get("id") or "").strip()
    if not cid:
        return JsonResponse({"ok": False, "error": "Missing id."}, status=400)

    try:
        with connection.cursor() as cur:
            cur.execute("DELETE FROM candidates_registration WHERE id = %s", [cid])
        return JsonResponse({"ok": True})
    except Exception:
        return JsonResponse({"ok": False, "error": "Failed to delete candidate."}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def admin_candidates_bulk_delete_api(request):
    forbidden = _require_admin(request)
    if forbidden:
        return forbidden

    try:
        payload = json.loads((request.body or b"{}").decode("utf-8"))
    except Exception:
        payload = {}

    ids = payload.get("ids") or []
    if not isinstance(ids, list) or not ids:
        return JsonResponse({"ok": False, "error": "Missing ids."}, status=400)

    ids = [str(i) for i in ids if str(i).strip()]
    if not ids:
        return JsonResponse({"ok": False, "error": "Missing ids."}, status=400)

    try:
        placeholders = ",".join(["%s"] * len(ids))
        with connection.cursor() as cur:
            cur.execute(f"DELETE FROM candidates_registration WHERE id IN ({placeholders})", ids)
        return JsonResponse({"ok": True})
    except Exception:
        return JsonResponse({"ok": False, "error": "Failed to delete candidates."}, status=500)


@require_http_methods(["GET"])
def admin_results_api(request):
    forbidden = _require_admin(request)
    if forbidden:
        return forbidden

    try:
        with connection.cursor() as cur:
            cur.execute(
                """
                SELECT c.id,
                       c.student_id,
                       c.first_name,
                       c.middle_name,
                       c.last_name,
                       c.organization,
                       c.position,
                       c.program,
                       c.year_section,
                       c.party_name,
                       c.candidate_type,
                       c.photo_url,
                       c.party_logo_url,
                       COALESCE(vv.cnt, 0) AS votes
                FROM candidates_registration c
                LEFT JOIN (
                    SELECT vi.candidate_id AS cid, COUNT(*) AS cnt
                    FROM vote_items vi
                    GROUP BY vi.candidate_id
                ) vv ON vv.cid = c.id
                ORDER BY c.party_name, c.organization, c.position, c.last_name, c.first_name
                """
            )
            cols = [c[0] for c in cur.description]
            candidates = [dict(zip(cols, r)) for r in cur.fetchall()]
    except Exception:
        return JsonResponse({"ok": False, "error": "Failed to load results."}, status=500)

    if not candidates:
        return JsonResponse(
            {"ok": True, "org_totals": {}, "position_totals": {}, "grouped": []}
        )

    usg_order = [
        "President",
        "Vice President",
        "General Secretary",
        "Associate Secretary",
        "Treasurer",
        "Auditor",
        "Public Information Officer",
        "P.I.O",
        "IT Representative",
        "BSIT Representative",
        "BTLED Representative",
        "BFPT Representative",
    ]
    org_order = [
        "President",
        "Vice President",
        "General Secretary",
        "Associate Secretary",
        "Treasurer",
        "Auditor",
        "Public Information Officer",
        "P.I.O",
    ]

    def pos_index(org: str, pos: str) -> int:
        org_key = (org or "").upper()
        lst = org_order if org_key in {"SITE", "PAFE", "AFPROTECHS"} else usg_order
        pos_s = (pos or "")
        for i, label in enumerate(lst):
            if label.lower() in pos_s.lower():
                return i
        return 999

    org_totals: dict[str, int] = {}
    position_totals: dict[str, int] = {}
    grouped_map: dict[str, dict[str, dict[str, list[dict]]]] = {}

    for c in candidates:
        party = (c.get("party_name") or "Independent").upper()
        org = (c.get("organization") or "USG").upper()
        pos = c.get("position") or "Unspecified"
        votes = int(c.get("votes") or 0)

        org_totals[org] = org_totals.get(org, 0) + votes
        position_totals[pos] = position_totals.get(pos, 0) + votes

        grouped_map.setdefault(party, {}).setdefault(org, {}).setdefault(pos, []).append(c)

    party_keys = sorted(grouped_map.keys(), key=lambda p: (1 if p == "INDEPENDENT" else 0, p))
    org_priority = {"USG": 0, "SITE": 1, "PAFE": 2, "AFPROTECHS": 3}

    grouped_out = []
    for party in party_keys:
        party_logo = ""
        total_party_votes = 0
        for org, pos_map in grouped_map[party].items():
            for pos, arr in pos_map.items():
                for x in arr:
                    total_party_votes += int(x.get("votes") or 0)
                    if not party_logo:
                        u = (x.get("party_logo_url") or "").strip()
                        if u.startswith("http"):
                            party_logo = u

        org_keys = sorted(
            grouped_map[party].keys(),
            key=lambda o: (org_priority.get(o.upper(), 999), o),
        )

        org_out = []
        for org in org_keys:
            pos_map = grouped_map[party][org]
            pos_keys = sorted(pos_map.keys(), key=lambda p: (pos_index(org, p), p))

            pos_out = []
            for pos in pos_keys:
                arr = pos_map[pos]
                arr_sorted = sorted(
                    arr,
                    key=lambda x: (
                        -int(x.get("votes") or 0),
                        str(x.get("last_name") or ""),
                        str(x.get("first_name") or ""),
                    ),
                )

                total_pos_votes = sum(int(x.get("votes") or 0) for x in arr_sorted) or 0
                cand_out = []
                for x in arr_sorted:
                    votes = int(x.get("votes") or 0)
                    pct = round((votes / total_pos_votes) * 100, 1) if total_pos_votes else 0.0
                    name = " ".join(
                        [
                            p
                            for p in [x.get("first_name"), x.get("middle_name"), x.get("last_name")]
                            if p
                        ]
                    ).strip()

                    cand_out.append(
                        {
                            "id": x.get("id"),
                            "student_id": str(x.get("student_id") or ""),
                            "name": name or str(x.get("student_id") or ""),
                            "program": x.get("program") or "",
                            "year_section": x.get("year_section") or "",
                            "photo_url": x.get("photo_url") or "",
                            "votes": votes,
                            "percent_in_position": pct,
                        }
                    )

                pos_out.append({"position": pos, "candidates": cand_out})

            org_out.append({"organization": org, "positions": pos_out})

        grouped_out.append(
            {
                "party_name": party,
                "party_logo_url": party_logo,
                "total_votes": int(total_party_votes),
                "organizations": org_out,
            }
        )

    return JsonResponse(
        {
            "ok": True,
            "org_totals": org_totals,
            "position_totals": position_totals,
            "grouped": grouped_out,
        }
    )


@csrf_exempt
@require_http_methods(["GET", "POST"])
def admin_election_window_api(request):
    forbidden = _require_admin(request)
    if forbidden:
        return forbidden

    def to_local_value(dt):
        if not dt:
            return ""
        try:
            return dt.strftime("%Y-%m-%dT%H:%M")
        except Exception:
            return ""

    if request.method == "GET":
        try:
            with connection.cursor() as cur:
                cur.execute(
                    "SELECT start_at, end_at, results_at, note FROM vote_windows ORDER BY id DESC LIMIT 1"
                )
                row = cur.fetchone()
            if not row:
                return JsonResponse({"ok": True, "window": None})
            start_at, end_at, results_at, note = row
            return JsonResponse(
                {
                    "ok": True,
                    "window": {
                        "start_at": start_at.isoformat() if start_at else None,
                        "end_at": end_at.isoformat() if end_at else None,
                        "results_at": results_at.isoformat() if results_at else None,
                        "note": note or "",
                        "start_at_local": to_local_value(start_at),
                        "end_at_local": to_local_value(end_at),
                        "results_at_local": to_local_value(results_at),
                    },
                }
            )
        except Exception as e:
            if getattr(settings, "DEBUG", False):
                return JsonResponse({"ok": False, "error": str(e)}, status=500)
            return JsonResponse({"ok": False, "error": "Failed to load election window."}, status=500)

    try:
        payload = json.loads((request.body or b"{}").decode("utf-8"))
    except Exception:
        payload = {}

    start_at = (payload.get("start_at") or "").strip()
    end_at = (payload.get("end_at") or "").strip()
    results_at = (payload.get("results_at") or "").strip() or None
    note = (payload.get("note") or "").strip()
    admin_password = (payload.get("admin_password") or "").strip()

    if not start_at or not end_at:
        return JsonResponse({"ok": False, "error": "Start and End date/time are required."}, status=400)

    if not admin_password:
        return JsonResponse({"ok": False, "error": "Admin password is required."}, status=400)

    from django.utils.dateparse import parse_datetime

    start_dt = parse_datetime(start_at)
    end_dt = parse_datetime(end_at)
    results_dt = parse_datetime(results_at) if results_at else None

    if not start_dt or not end_dt:
        return JsonResponse({"ok": False, "error": "Invalid date/time format."}, status=400)

    if end_dt <= start_dt:
        return JsonResponse({"ok": False, "error": "End must be after Start."}, status=400)

    if results_dt and results_dt < end_dt:
        return JsonResponse({"ok": False, "error": "Results date/time must be on/after End."}, status=400)

    try:
        with connection.cursor() as cur:
            cur.execute("SELECT id FROM vote_windows ORDER BY id DESC LIMIT 1")
            last = cur.fetchone()
            if last and last[0] is not None:
                cur.execute(
                    """
                    UPDATE vote_windows
                    SET start_at = %s,
                        end_at = %s,
                        results_at = %s,
                        note = %s,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = %s
                    """,
                    [start_dt, end_dt, results_dt, note or None, last[0]],
                )
            else:
                cur.execute(
                    """
                    INSERT INTO vote_windows (start_at, end_at, results_at, note)
                    VALUES (%s, %s, %s, %s)
                    """,
                    [start_dt, end_dt, results_dt, note or None],
                )
        return JsonResponse({"ok": True})
    except Exception as e:
        if getattr(settings, "DEBUG", False):
            return JsonResponse({"ok": False, "error": str(e)}, status=500)
        return JsonResponse({"ok": False, "error": "Failed to save election window."}, status=500)


@require_http_methods(["GET"])
def admin_reports_summary_api(request):
    forbidden = _require_admin(request)
    if forbidden:
        return forbidden

    start = (request.GET.get("start") or "").strip()
    end = (request.GET.get("end") or "").strip()

    # We'll interpret start/end as date-only (YYYY-MM-DD). If provided, we apply inclusive range.
    start_dt = None
    end_dt_exclusive = None

    if start:
        from django.utils.dateparse import parse_date

        d = parse_date(start)
        if not d:
            return JsonResponse({"ok": False, "error": "Invalid start date."}, status=400)
        from datetime import datetime

        start_dt = datetime(d.year, d.month, d.day)

    if end:
        from django.utils.dateparse import parse_date

        d = parse_date(end)
        if not d:
            return JsonResponse({"ok": False, "error": "Invalid end date."}, status=400)
        from datetime import datetime, timedelta

        end_dt_exclusive = datetime(d.year, d.month, d.day) + timedelta(days=1)

    where_votes = ""
    params: list = []
    if start_dt:
        where_votes += " AND v.created_at >= %s"
        params.append(start_dt)
    if end_dt_exclusive:
        where_votes += " AND v.created_at < %s"
        params.append(end_dt_exclusive)

    # totals
    try:
        with connection.cursor() as cur:
            cur.execute(f"SELECT COUNT(*) FROM votes v WHERE 1=1{where_votes}", params)
            total_votes = int(cur.fetchone()[0] or 0)
            cur.execute(
                f"SELECT COUNT(DISTINCT v.student_id) FROM votes v WHERE 1=1{where_votes}",
                params,
            )
            distinct_voters = int(cur.fetchone()[0] or 0)
    except Exception:
        total_votes = 0
        distinct_voters = 0

    # candidates + votes per candidate
    candidates = []
    try:
        with connection.cursor() as cur:
            cur.execute(
                """
                SELECT c.id, c.student_id, c.first_name, c.middle_name, c.last_name,
                       c.organization, c.position,
                       COALESCE(vv.cnt, 0) AS votes
                FROM candidates_registration c
                LEFT JOIN (
                  SELECT vi.candidate_id AS cid, COUNT(*) AS cnt
                  FROM vote_items vi
                  GROUP BY vi.candidate_id
                ) vv ON vv.cid = c.id
                ORDER BY c.organization, c.position, c.last_name, c.first_name
                """
            )
            cols = [c[0] for c in cur.description]
            candidates = [dict(zip(cols, r)) for r in cur.fetchall()]
    except Exception:
        candidates = []

    # breakdowns
    by_org: dict[str, int] = {}
    by_pos: dict[str, int] = {}
    for c in candidates:
        org = (c.get("organization") or "USG").upper()
        pos = c.get("position") or "Unspecified"
        votes = int(c.get("votes") or 0)
        by_org[org] = by_org.get(org, 0) + votes
        by_pos[pos] = by_pos.get(pos, 0) + votes

    return JsonResponse(
        {
            "ok": True,
            "range": {"start": start or None, "end": end or None},
            "totals": {
                "total_votes": total_votes,
                "distinct_voters": distinct_voters,
                "total_candidates": len(candidates),
            },
            "by_org": by_org,
            "by_pos": by_pos,
            "candidates": candidates,
        }
    )


@require_http_methods(["GET"])
def admin_reset_status_api(request):
    forbidden = _require_admin(request)
    if forbidden:
        return forbidden

    def safe_count(sql: str) -> int:
        try:
            with connection.cursor() as cur:
                cur.execute(sql)
                row = cur.fetchone()
            return int(row[0] or 0) if row else 0
        except Exception:
            return 0

    return JsonResponse(
        {
            "ok": True,
            "counts": {
                "votes": safe_count("SELECT COUNT(*) FROM votes"),
                "vote_items": safe_count("SELECT COUNT(*) FROM vote_items"),
                "notifications": safe_count("SELECT COUNT(*) FROM user_notifications"),
            },
        }
    )


@csrf_exempt
@require_http_methods(["POST"])
def admin_reset_votes_api(request):
    forbidden = _require_admin(request)
    if forbidden:
        return forbidden

    try:
        payload = json.loads((request.body or b"{}").decode("utf-8"))
    except Exception:
        payload = {}

    confirm = (payload.get("confirm") or "").strip().upper()
    if confirm != "RESET":
        return JsonResponse({"ok": False, "error": "Type RESET to confirm."}, status=400)

    try:
        with connection.cursor() as cur:
            cur.execute("BEGIN")
            # Delete children first
            cur.execute("DELETE FROM vote_items")
            try:
                cur.execute("DELETE FROM vote_results")
            except Exception:
                pass
            cur.execute("DELETE FROM votes")
            cur.execute("COMMIT")
        return JsonResponse({"ok": True})
    except Exception:
        try:
            with connection.cursor() as cur:
                cur.execute("ROLLBACK")
        except Exception:
            pass
        return JsonResponse({"ok": False, "error": "Failed to reset votes."}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def admin_reset_notifications_api(request):
    forbidden = _require_admin(request)
    if forbidden:
        return forbidden

    try:
        payload = json.loads((request.body or b"{}").decode("utf-8"))
    except Exception:
        payload = {}

    confirm = (payload.get("confirm") or "").strip().upper()
    if confirm != "CLEAR":
        return JsonResponse({"ok": False, "error": "Type CLEAR to confirm notifications reset."}, status=400)

    try:
        with connection.cursor() as cur:
            cur.execute("DELETE FROM user_notifications")
        return JsonResponse({"ok": True})
    except Exception:
        return JsonResponse({"ok": False, "error": "Failed to clear notifications."}, status=500)