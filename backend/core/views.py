from __future__ import annotations
from datetime import timezone as dt_timezone
from zoneinfo import ZoneInfo

import json
import hashlib
import logging
import os
import shutil
import subprocess
import tempfile
import time
import urllib.error
import urllib.request
import io
import ipaddress
import zipfile
from pathlib import Path

from decimal import Decimal
from datetime import datetime, timedelta, timezone as dt_timezone

from django.http import FileResponse, HttpResponse, JsonResponse
from django.shortcuts import render
from django.db import connection, transaction
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from django.conf import settings
from django.utils import timezone
from django.core import signing

from elecom_auth.models import ElecomUser
from elecom_voting.models import (
    AppRating,
    EleVoteChatMessage,
    FaceEnrollment,
    FaceVerificationLog,
    MobileTutorialState,
)

from . import facepp_service
from .cloudinary_upload import upload_enrollment_image_bytes

logger = logging.getLogger(__name__)

def _ensure_auth_identity_tables() -> None:
    with connection.cursor() as cur:
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS student (
                id_number varchar(64) PRIMARY KEY,
                first_name varchar(255) NOT NULL,
                middle_name varchar(255) NOT NULL DEFAULT '',
                last_name varchar(255) NOT NULL,
                course varchar(255) NOT NULL,
                year integer NOT NULL,
                section varchar(255) NOT NULL,
                email varchar(255) NOT NULL,
                phone_number varchar(255) NOT NULL,
                role varchar(255) NOT NULL DEFAULT 'student'
            )
            """
        )
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                student_id varchar(64) DEFAULT NULL,
                password_hash varchar(255) NOT NULL,
                created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
                role varchar(32) NOT NULL DEFAULT 'user',
                department varchar(128) DEFAULT NULL,
                year_level smallint DEFAULT NULL,
                section varchar(50) DEFAULT NULL,
                position varchar(128) DEFAULT NULL,
                phone varchar(32) DEFAULT NULL,
                email varchar(255) DEFAULT NULL,
                otp_code varchar(255) DEFAULT NULL,
                otp_expires_at timestamp DEFAULT NULL,
                terms_accepted_at timestamp DEFAULT NULL,
                first_name varchar(128) DEFAULT NULL,
                middle_name varchar(128) DEFAULT NULL,
                last_name varchar(128) DEFAULT NULL,
                photo_url text DEFAULT NULL
            )
            """
        )
        cur.execute(
            """
            SELECT data_type
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'student'
              AND column_name = 'id_number'
            """
        )
        row = cur.fetchone()
        if row and str(row[0] or "").lower() not in {"character varying", "text"}:
            cur.execute(
                """
                ALTER TABLE student
                ALTER COLUMN id_number TYPE varchar(64)
                USING id_number::text
                """
            )
        cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_url text DEFAULT NULL")

_DUP_FACE_ENROLL_MSG = (
    "This face is already registered to another account. Please contact ELECOM."
)
_MISMATCH_VOTER_MSG = "Face verification failed. This face does not match the enrolled voter."
_SESSION_FACE_VOTE_STD = "_elecom_fv_std"
_SESSION_FACE_VOTE_EXP = "_elecom_fv_exp"
_ADMIN_PAGE_TOKEN_SALT = "elecom.admin.page.hash"
_ADMIN_PAGE_ROUTE_SALT = "elecom.admin.page.route"
_ADMIN_PAGE_ALLOWLIST = {
    "admin_dashboard.html",
    "elecom_register_candidate.html",
    "elecom_elections.html",
    "elecom_election_date.html",
    "elecom_candidates.html",
    "elecom_voters.html",
    "elecom_results.html",
    "elecom_reset.html",
    "elecom_reports.html",
    "elecom_backup_restore.html",
    "elecom_transparency.html",
    "elecom_network_authorize.html",
    "profile.html",
    "search_results.html",
}


def _normalize_admin_page_name(page: str) -> str:
    page = str(page or "admin_dashboard.html").strip()
    if page == "elecom_election_date.html":
        return "elecom_elections.html"
    if page not in _ADMIN_PAGE_ALLOWLIST:
        return "admin_dashboard.html"
    return page


def _normalize_admin_html(html: str) -> str:
    return (
        html.replace("Set Election Dates", "Election Management")
        .replace(
            "/static/org_elecom/elecom_admin/elecom_election_date.html",
            "/static/org_elecom/elecom_admin/elecom_elections.html",
        )
    )


def _serve_admin_static_page(request, page: str):
    forbidden = _require_admin(request)
    if forbidden:
        return forbidden

    page = _normalize_admin_page_name(page)
    root = Path(settings.BASE_DIR).parent / "frontend" / "org_elecom" / "elecom_admin"
    page_path = (root / page).resolve()
    if root.resolve() not in page_path.parents or not page_path.exists():
        return JsonResponse({"ok": False, "error": "Page not found."}, status=404)

    html = _normalize_admin_html(page_path.read_text(encoding="utf-8"))
    return HttpResponse(html, content_type="text/html")


@require_http_methods(["GET"])
def edit_election_dates(request, election_id):
    return _serve_admin_static_page(request, "elecom_elections.html")


@require_http_methods(["GET"])
def election_results(request, election_id):
    return _serve_admin_static_page(request, "elecom_results.html")


@require_http_methods(["GET"])
def election_reports(request, election_id):
    return _serve_admin_static_page(request, "elecom_reports.html")


@require_http_methods(["GET"])
def backup_restore_page(request):
    return _serve_admin_static_page(request, "elecom_backup_restore.html")


def _facepp_configured() -> bool:
    return bool((getattr(settings, "FACEPP_API_KEY", None) or "").strip()) and bool(
        (getattr(settings, "FACEPP_API_SECRET", None) or "").strip()
    )


def _session_face_vote_valid(request, student_id: str) -> bool:
    sid = request.session.get(_SESSION_FACE_VOTE_STD)
    exp = float(request.session.get(_SESSION_FACE_VOTE_EXP) or 0)
    if sid != student_id or time.time() > exp:
        return False
    return True


def _set_session_face_vote_verified(request, student_id: str) -> None:
    mins = int(getattr(settings, "FACE_VOTE_VERIFY_SESSION_MINUTES", 20) or 20)
    request.session[_SESSION_FACE_VOTE_STD] = student_id
    request.session[_SESSION_FACE_VOTE_EXP] = float(time.time() + mins * 60)
    request.session.modified = True


def _clear_session_face_vote(request, student_id: str | None = None) -> None:
    if student_id is not None and request.session.get(_SESSION_FACE_VOTE_STD) != student_id:
        return
    request.session.pop(_SESSION_FACE_VOTE_STD, None)
    request.session.pop(_SESSION_FACE_VOTE_EXP, None)
    request.session.modified = True


def _multipart_face_upload(request):
    ctype = (request.content_type or "").lower()
    if "multipart/form-data" not in ctype:
        return None
    for key in ("face_image", "image", "file", "face"):
        f = request.FILES.get(key)
        if f is not None:
            return f
    return None


def _post_bool(payload: dict, key: str, default: bool = False) -> bool:
    v = payload.get(key)
    if v is None:
        return default
    if isinstance(v, bool):
        return v
    s = str(v).strip().lower()
    return s in ("1", "true", "yes", "on")


def _parse_election_id_from_request(request, payload: dict) -> int | None:
    raw = payload.get("election_id")
    if raw is None and hasattr(request, "POST"):
        raw = request.POST.get("election_id")
    if raw in (None, ""):
        return None
    try:
        return int(raw)
    except (TypeError, ValueError):
        return None


def _ensure_election_scoped_tables() -> None:
    """
    Add election scope to the existing ELECOM tables without deleting history.
    vote_windows.id is used as the election/event id already, so this keeps the
    current system shape and lets old rows remain reportable.
    """
    with connection.cursor() as cur:
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS vote_windows (
                id BIGSERIAL PRIMARY KEY,
                election_name varchar(255) NULL,
                school_year varchar(50) NULL,
                status varchar(32) NOT NULL DEFAULT 'active',
                start_at timestamp NULL,
                end_at timestamp NULL,
                results_at timestamp NULL,
                note text NULL,
                created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        cur.execute("ALTER TABLE vote_windows ADD COLUMN IF NOT EXISTS election_name varchar(255) NULL")
        cur.execute("ALTER TABLE vote_windows ADD COLUMN IF NOT EXISTS school_year varchar(50) NULL")
        cur.execute("ALTER TABLE vote_windows ADD COLUMN IF NOT EXISTS status varchar(32) NOT NULL DEFAULT 'active'")
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS candidates_registration (
                id BIGSERIAL PRIMARY KEY,
                student_id VARCHAR(64) NOT NULL,
                first_name VARCHAR(255) NOT NULL,
                middle_name VARCHAR(255),
                last_name VARCHAR(255) NOT NULL,
                organization VARCHAR(255) NOT NULL,
                position VARCHAR(255) NOT NULL,
                program VARCHAR(255),
                year_section VARCHAR(255),
                platform TEXT,
                photo_url TEXT,
                party_name VARCHAR(255),
                candidate_type VARCHAR(64),
                party_logo_url TEXT,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                votes INTEGER NOT NULL DEFAULT 0,
                election_id BIGINT NULL
            )
            """
        )
        cur.execute("ALTER TABLE candidates_registration ADD COLUMN IF NOT EXISTS first_name VARCHAR(255)")
        cur.execute("ALTER TABLE candidates_registration ADD COLUMN IF NOT EXISTS middle_name VARCHAR(255)")
        cur.execute("ALTER TABLE candidates_registration ADD COLUMN IF NOT EXISTS last_name VARCHAR(255)")
        cur.execute("ALTER TABLE candidates_registration ADD COLUMN IF NOT EXISTS organization VARCHAR(255)")
        cur.execute("ALTER TABLE candidates_registration ADD COLUMN IF NOT EXISTS position VARCHAR(255)")
        cur.execute("ALTER TABLE candidates_registration ADD COLUMN IF NOT EXISTS program VARCHAR(255)")
        cur.execute("ALTER TABLE candidates_registration ADD COLUMN IF NOT EXISTS year_section VARCHAR(255)")
        cur.execute("ALTER TABLE candidates_registration ADD COLUMN IF NOT EXISTS platform TEXT")
        cur.execute("ALTER TABLE candidates_registration ADD COLUMN IF NOT EXISTS photo_url TEXT")
        cur.execute("ALTER TABLE candidates_registration ADD COLUMN IF NOT EXISTS party_name VARCHAR(255)")
        cur.execute("ALTER TABLE candidates_registration ADD COLUMN IF NOT EXISTS candidate_type VARCHAR(64)")
        cur.execute("ALTER TABLE candidates_registration ADD COLUMN IF NOT EXISTS party_logo_url TEXT")
        cur.execute("ALTER TABLE candidates_registration ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NULL")
        cur.execute("ALTER TABLE candidates_registration ADD COLUMN IF NOT EXISTS votes INTEGER")
        cur.execute("UPDATE candidates_registration SET created_at = COALESCE(created_at, CURRENT_TIMESTAMP) WHERE created_at IS NULL")
        cur.execute("UPDATE candidates_registration SET votes = COALESCE(votes, 0) WHERE votes IS NULL")
        cur.execute("ALTER TABLE candidates_registration ALTER COLUMN created_at SET NOT NULL")
        cur.execute("ALTER TABLE candidates_registration ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP")
        cur.execute("ALTER TABLE candidates_registration ALTER COLUMN votes SET NOT NULL")
        cur.execute("ALTER TABLE candidates_registration ALTER COLUMN votes SET DEFAULT 0")
        cur.execute(
            """
            ALTER TABLE candidates_registration
            ADD COLUMN IF NOT EXISTS election_id BIGINT NULL
            """
        )
        cur.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_candidates_registration_position
            ON candidates_registration (position)
            """
        )
        cur.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_candidates_registration_org
            ON candidates_registration (organization)
            """
        )
        cur.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_candidates_registration_party
            ON candidates_registration (party_name)
            """
        )
        cur.execute(
            """
            CREATE INDEX IF NOT EXISTS ix_candidates_registration_created_at
            ON candidates_registration (created_at)
            """
        )
        cur.execute(
            """
            CREATE INDEX IF NOT EXISTS ix_candidates_registration_votes
            ON candidates_registration (votes)
            """
        )
        cur.execute(
            """
            ALTER TABLE IF EXISTS votes
            ADD COLUMN IF NOT EXISTS election_id BIGINT NULL
            """
        )
        cur.execute(
            """
            ALTER TABLE IF EXISTS vote_items
            ADD COLUMN IF NOT EXISTS election_id BIGINT NULL
            """
        )
        cur.execute(
            """
            CREATE INDEX IF NOT EXISTS ix_candidates_registration_election_id
            ON candidates_registration (election_id)
            """
        )
        cur.execute(
            """
            CREATE INDEX IF NOT EXISTS ix_votes_election_student
            ON votes (election_id, student_id)
            """
        )
        cur.execute(
            """
            CREATE INDEX IF NOT EXISTS ix_vote_items_election_candidate
            ON vote_items (election_id, candidate_id)
            """
        )
        cur.execute("DROP INDEX IF EXISTS ux_candidates_registration_student_position")
        cur.execute(
            """
            DO $$
            DECLARE
                r record;
            BEGIN
                FOR r IN
                    SELECT conname
                    FROM pg_constraint
                    WHERE conrelid = 'candidates_registration'::regclass
                      AND contype = 'u'
                      AND pg_get_constraintdef(oid) ILIKE '%student_id%'
                      AND pg_get_constraintdef(oid) ILIKE '%position%'
                      AND pg_get_constraintdef(oid) NOT ILIKE '%election_id%'
                LOOP
                    EXECUTE format('ALTER TABLE candidates_registration DROP CONSTRAINT IF EXISTS %I', r.conname);
                END LOOP;

                FOR r IN
                    SELECT indexname
                    FROM pg_indexes
                    WHERE schemaname = 'public'
                      AND tablename = 'candidates_registration'
                      AND indexdef ILIKE 'CREATE UNIQUE INDEX%'
                      AND indexdef ILIKE '%student_id%'
                      AND indexdef ILIKE '%position%'
                      AND indexdef NOT ILIKE '%election_id%'
                LOOP
                    EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
                END LOOP;
            END
            $$;
            """
        )
        cur.execute(
            """
            CREATE UNIQUE INDEX IF NOT EXISTS ux_candidates_registration_election_student_position
            ON candidates_registration (COALESCE(election_id, 0), student_id, position)
            """
        )
        cur.execute(
            """
            SELECT setval(
                pg_get_serial_sequence('candidates_registration', 'id'),
                COALESCE((SELECT MAX(id) FROM candidates_registration), 0) + 1,
                false
            )
            WHERE pg_get_serial_sequence('candidates_registration', 'id') IS NOT NULL
            """
        )


def _current_election_filter(alias: str = "", election_id: int | None = None) -> tuple[str, list[int]]:
    election_id = _active_election_id() if election_id is None else election_id
    if election_id is None:
        return "1=1", []
    prefix = f"{alias}." if alias else ""
    return (
        f"({prefix}election_id = %s OR "
        f"({prefix}election_id IS NULL AND NOT EXISTS ("
        "SELECT 1 FROM candidates_registration WHERE election_id IS NOT NULL"
        ")))"
    ), [int(election_id)]


def _current_vote_filter(alias: str = "", election_id: int | None = None) -> tuple[str, list[int]]:
    election_id = _active_election_id() if election_id is None else election_id
    if election_id is None:
        return "1=1", []
    prefix = f"{alias}." if alias else ""
    return (
        f"({prefix}election_id = %s OR "
        f"({prefix}election_id IS NULL AND NOT EXISTS ("
        "SELECT 1 FROM candidates_registration WHERE election_id IS NOT NULL"
        ") OR ("
        f"{prefix}election_id IS NULL AND %s <> COALESCE((SELECT MAX(id) FROM vote_windows), 0)"
        ")))"
    ), [int(election_id), int(election_id)]


def _election_status_from_window(election_id, max_id, start_at, end_at, db_status="active") -> str:
    if election_id is not None and max_id is not None and int(election_id) < int(max_id):
        return "archived"
    raw = str(db_status or "").strip().lower()
    if raw in {"archived", "closed"}:
        return raw
    if not start_at or not end_at:
        return "draft"
    vote_phase, _results_phase = _compute_election_phases(
        now=timezone.now(),
        start_at=start_at,
        end_at=end_at,
        results_at=None,
    )
    if vote_phase == "active":
        return "active"
    if vote_phase == "upcoming":
        return "upcoming"
    return "closed"


def _download_public_image(url: str, max_bytes: int = 8 * 1024 * 1024) -> bytes | None:
    u = (url or "").strip()
    if not u.startswith(("http://", "https://")):
        return None
    try:
        req = urllib.request.Request(u, headers={"User-Agent": "ElecomFaceVerify/1.0"})
        with urllib.request.urlopen(req, timeout=25) as res:
            parts: list[bytes] = []
            n = 0
            while True:
                chunk = res.read(65536)
                if not chunk:
                    break
                n += len(chunk)
                if n > max_bytes:
                    return None
                parts.append(chunk)
            return b"".join(parts)
    except Exception:
        return None


def _get_student_program_code(student_id: str) -> str:
    sid = (student_id or "").strip()
    if not sid:
        return ""

    raw_department = ""
    try:
        with connection.cursor() as cur:
            cur.execute(
                """
                SELECT department
                FROM public.users
                WHERE student_id::text = %s
                ORDER BY id DESC
                LIMIT 1
                """,
                [sid],
            )
            row = cur.fetchone()
            if row and row[0] is not None:
                raw_department = str(row[0])
    except Exception:
        raw_department = ""

    s_dept = (raw_department or "").upper()
    if "BSIT" in s_dept or "B.S.I.T" in s_dept or "INFORMATION TECHNOLOGY" in s_dept:
        return "BSIT"
    if "BTLED" in s_dept or "B.T.L.E.D" in s_dept or "LIVELIHOOD" in s_dept:
        return "BTLED"
    if "BFPT" in s_dept or "B.F.P.T" in s_dept or "FOOD PROCESS" in s_dept:
        return "BFPT"

    raw = ""
    try:
        with connection.cursor() as cur:
            attempts: list[tuple[str, list]] = [
                (
                    """
                    SELECT course
                    FROM public.student
                    WHERE id_number::text = %s
                    LIMIT 1
                    """,
                    [sid],
                ),
                (
                    """
                    SELECT course
                    FROM student
                    WHERE id_number::text = %s
                    LIMIT 1
                    """,
                    [sid],
                ),
            ]

            for sql, params in attempts:
                try:
                    cur.execute(sql, params)
                    row = cur.fetchone()
                    if row and row[0] is not None:
                        raw = str(row[0])
                        break
                except Exception:
                    continue
    except Exception:
        raw = ""

    s = (raw or "").upper()
    if "BSIT" in s or "B.S.I.T" in s or "INFORMATION TECHNOLOGY" in s:
        return "BSIT"
    if "BTLED" in s or "B.T.L.E.D" in s or "LIVELIHOOD" in s:
        return "BTLED"
    if "BFPT" in s or "B.F.P.T" in s or "FOOD PROCESS" in s:
        return "BFPT"
    return ""


def _eligible_orgs_for_program(program_code: str) -> list[str]:
    code = (program_code or "").upper()
    if code == "BSIT":
        return ["USG", "SITE"]
    if code == "BTLED":
        return ["USG", "PAFE"]
    if code == "BFPT":
        return ["USG", "AFPROTECHS"]
    return ["USG"]


def _usg_allowed_representative_positions(program_code: str) -> set[str]:
    """USG representative rows a voter may see/select, based on their program."""
    code = (program_code or "").upper()
    if code == "BSIT":
        return {"BSIT REPRESENTATIVE", "IT REPRESENTATIVE"}
    if code == "BTLED":
        return {"BTLED REPRESENTATIVE"}
    if code == "BFPT":
        return {"BFPT REPRESENTATIVE"}
    return set()


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

    _ensure_auth_identity_tables()

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

    # Notifications and mobile APIs key off this string; fall back to users.id when student_id is empty
    # (some admin rows only have id + role).
    session_student_id = (user.student_id or "").strip()
    if not session_student_id:
        session_student_id = str(int(user.id))

    request.session["student_id"] = session_student_id
    request.session["role"] = user.role

    return JsonResponse({"ok": True, "student_id": session_student_id, "role": user.role})


@require_http_methods(["GET"])
def terms_conditions_view(request):
    return render(request, "elecom_terms_conditions.html")


@require_http_methods(["GET"])
def account_profile_api(request):
    _ensure_auth_identity_tables()

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
                    WHERE student_id::text = %s OR id::text = %s
                    ORDER BY CASE WHEN student_id::text = %s THEN 0 ELSE 1 END, id DESC
                    LIMIT 1
                    """,
                    [student_id, student_id, student_id],
                )
            except Exception:
                cur.execute(
                    """
                    SELECT id, student_id, role, created_at,
                           department, year_level, section, position,
                           phone, email,
                           first_name, middle_name, last_name
                    FROM users
                    WHERE student_id::text = %s OR id::text = %s
                    ORDER BY CASE WHEN student_id::text = %s THEN 0 ELSE 1 END, id DESC
                    LIMIT 1
                    """,
                    [student_id, student_id, student_id],
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
    except Exception:
        student_row = None

    return JsonResponse(
        {
            "ok": True,
            "student_id": student_id,
            "user": user_row,
            "student": student_row,
        }
    )


@csrf_exempt
@require_http_methods(["GET", "POST"])
def mobile_tutorial_state_api(request):
    student_id = (request.session.get("student_id") or "").strip()
    if not student_id:
        return JsonResponse({"ok": False, "error": "Unauthorized."}, status=401)

    state, _ = MobileTutorialState.objects.get_or_create(student_id=student_id)

    if request.method == "POST":
        try:
            payload = json.loads((request.body or b"{}").decode("utf-8"))
        except Exception:
            payload = {}

        allowed = {
            "login_done": "login_done",
            "home_done": "home_done",
            "voting_done": "voting_done",
        }
        changed = False
        for key, attr in allowed.items():
            if key not in payload:
                continue
            setattr(state, attr, _post_bool(payload, key, getattr(state, attr)))
            changed = True

        if changed:
            state.save(update_fields=["login_done", "home_done", "voting_done", "updated_at"])

    return JsonResponse(
        {
            "ok": True,
            "tutorial": {
                "login_done": state.login_done,
                "home_done": state.home_done,
                "voting_done": state.voting_done,
            },
        }
    )


@csrf_exempt
@require_http_methods(["POST"])
def account_app_rating_api(request):
    student_id = (request.session.get("student_id") or "").strip()
    if not student_id:
        return JsonResponse({"ok": False, "error": "Unauthorized."}, status=401)

    try:
        payload = json.loads((request.body or b"{}").decode("utf-8"))
    except Exception:
        payload = {}

    rating_raw = payload.get("rating")
    label = str(payload.get("label") or "").strip()

    try:
        rating = int(rating_raw)
    except Exception:
        rating = 0

    if rating < 1 or rating > 5:
        return JsonResponse({"ok": False, "error": "Invalid rating."}, status=400)
    if not label or len(label) > 32:
        return JsonResponse({"ok": False, "error": "Invalid label."}, status=400)

    ip_address = (request.META.get("HTTP_X_FORWARDED_FOR") or request.META.get("REMOTE_ADDR") or "").split(",")[0].strip() or None
    user_agent = (request.META.get("HTTP_USER_AGENT") or "").strip() or None
    if user_agent is not None and len(user_agent) > 512:
        user_agent = user_agent[:512]

    try:
        row = AppRating.objects.create(
            student_id=student_id,
            rating=rating,
            label=label,
            ip_address=ip_address,
            user_agent=user_agent,
        )
    except Exception as e:
        if getattr(settings, "DEBUG", False):
            return JsonResponse({"ok": False, "error": str(e)}, status=500)
        return JsonResponse({"ok": False, "error": "Failed to save rating."}, status=500)

    return JsonResponse(
        {
            "ok": True,
            "id": row.id,
            "rating": row.rating,
            "label": row.label,
            "created_at": row.created_at.isoformat() if row.created_at else None,
        }
    )


def _elevote_message_json(row: EleVoteChatMessage) -> dict:
    return {
        "id": row.id,
        "role": row.role,
        "content": row.content,
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }


def _ensure_elevote_chat_table() -> None:
    with connection.cursor() as cur:
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS elevote_chat_messages (
                id BIGSERIAL PRIMARY KEY,
                student_id varchar(64) NOT NULL,
                role varchar(16) NOT NULL,
                content text NOT NULL,
                model varchar(128) NULL,
                created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        cur.execute(
            """
            CREATE INDEX IF NOT EXISTS elevote_student_created_idx
            ON elevote_chat_messages (student_id, created_at)
            """
        )
        cur.execute(
            """
            CREATE INDEX IF NOT EXISTS elevote_role_idx
            ON elevote_chat_messages (role)
            """
        )


def _elevote_groq_reply(student_id: str, message: str) -> tuple[str, str]:
    api_key = (getattr(settings, "GROQ_API_KEY", "") or "").strip()
    if not api_key:
        raise RuntimeError("Groq API key is not configured.")

    _ensure_elevote_chat_table()

    model = (getattr(settings, "GROQ_MODEL", "") or "llama-3.1-8b-instant").strip()
    recent = list(
        EleVoteChatMessage.objects.filter(student_id=student_id)
        .order_by("-created_at")
        .values("role", "content")[:12]
    )
    recent.reverse()

    messages = [
        {
            "role": "system",
            "content": (
                "You are EleVote, the concise AI assistant for the ELECOM USTP "
                "Oroquieta Campus mobile voting app. ELECOM means Electoral "
                "Commission, the official campus body that manages and supervises "
                "student elections at the University of Science and Technology of "
                "Southern Philippines Oroquieta Campus. The system is the Electoral "
                "Commission Voting System (ECVS), a mobile and web-based campus "
                "election platform built to improve election efficiency, accuracy, "
                "security, transparency, and integrity compared with manual paper "
                "ballots and manual vote counting. The developer of this system is "
                "Redjan Phil S. Visitacion. It supports student login, "
                "candidate viewing, ballot selection, face verification, dynamic "
                "network-restricted voting on authorized campus networks, automated "
                "vote counting, receipts, result viewing, and cryptographic "
                "ledger/hash-based vote verification. Campus organizations include "
                "SITE, the Society of Information Technology Enthusiasts; PAFE, the "
                "Prime Association of Future Educators; and AFPRO/AFORO, the "
                "Association of Food Processing Technology Students. Help voters understand login, "
                "eligibility, candidate lists, ballot selection, face verification, "
                "receipts, result viewing, privacy, and support. Do not invent "
                "official election results, candidate facts, or live database values. "
                "If app/backend data is needed, tell the voter to check the relevant "
                "screen or contact ELECOM."
            ),
        }
    ]
    for item in recent:
        role = item.get("role") if item.get("role") in {"user", "assistant"} else "user"
        content = str(item.get("content") or "").strip()
        if content:
            messages.append({"role": role, "content": content[:2000]})
    messages.append({"role": "user", "content": message[:2000]})

    payload = json.dumps(
        {
            "model": model,
            "messages": messages,
            "temperature": 0.25,
            "max_tokens": 450,
        }
    ).encode("utf-8")

    req = urllib.request.Request(
        "https://api.groq.com/openai/v1/chat/completions",
        data=payload,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "ELECOM-Mobile/1.0 (+https://elecom.app)",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            raw = resp.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", errors="ignore")
        raise RuntimeError(f"Groq request failed ({e.code}): {detail[:300]}")

    decoded = json.loads(raw)
    choices = decoded.get("choices")
    if not choices:
        raise RuntimeError("Groq returned no choices.")
    reply = choices[0].get("message", {}).get("content", "").strip()
    if not reply:
        raise RuntimeError("Groq returned an empty reply.")
    return reply, model


def _elevote_fallback_reply(message: str) -> str:
    text = (message or "").lower()
    if (
        "developer" in text
        or "who made" in text
        or "who created" in text
        or "creator" in text
    ):
        return (
            "The developer of this system is Redjan Phil S. Visitacion. He developed "
            "the ELECOM Electoral Commission Voting System for USTP Oroquieta Campus."
        )
    if "site" in text:
        return (
            "SITE is a campus organization, the Society of Information Technology "
            "Enthusiasts. In the ELECOM voting app, SITE refers to the IT-related "
            "student organization, not an internet website."
        )
    if "pafe" in text:
        return (
            "PAFE means Prime Association of Future Educators. It is one of the "
            "student organizations represented in the ELECOM voting system."
        )
    if "afpro" in text or "aforo" in text or "food processing" in text:
        return (
            "AFPRO, also written by some users as AFORO, means Association of Food "
            "Processing Technology Students. It is one of the student organizations "
            "represented in the ELECOM voting system."
        )
    if "elecom" in text or "electoral commission" in text or "ecvs" in text:
        return (
            "ELECOM means Electoral Commission. At USTP Oroquieta Campus, ELECOM "
            "is the official body that manages and supervises student elections. "
            "The ELECOM app is part of the Electoral Commission Voting System "
            "(ECVS), a secure mobile and web-based platform for student voting, "
            "candidate viewing, face verification, receipts, results, and transparent "
            "vote verification."
        )
    if "how" in text and "vote" in text:
        return (
            "To vote, open the Election tab while the election is active, choose your "
            "candidate for each position, review your selections, complete face "
            "verification if asked, then submit your ballot."
        )
    if "change" in text and "vote" in text:
        return (
            "No. After your ballot is submitted, you cannot change your vote. Please "
            "review every selected candidate carefully before pressing Submit ballot."
        )
    if "receipt" in text:
        return (
            "Open the Receipt tab after voting. If it says no receipt yet, wait a moment "
            "and refresh; the receipt appears once the server has recorded it."
        )
    if "result" in text:
        return (
            "Open the Results tab. Results are shown only after ELECOM publishes them "
            "for the election."
        )
    if "face" in text or "verification" in text:
        return (
            "For face verification, use good lighting, keep your face centered, and avoid "
            "covering your face. If it still fails, contact ELECOM support."
        )
    if "usg" in text or "site" in text or "candidate" in text:
        return (
            "The app shows only the candidates your account is allowed to vote for, such "
            "as USG and your organization candidates. If this looks wrong, confirm your "
            "program/profile details with ELECOM."
        )
    return (
        "I can help with voting steps, candidate eligibility, face verification, receipts, "
        "results, and ELECOM app support. Please ask your question again with a little "
        "more detail."
    )


@csrf_exempt
@require_http_methods(["GET", "POST"])
def elevote_chat_api(request):
    student_id = (request.session.get("student_id") or "").strip()
    if not student_id:
        return JsonResponse({"ok": False, "error": "Unauthorized."}, status=401)

    try:
        _ensure_elevote_chat_table()
    except Exception as e:
        logger.exception("Failed to ensure EleVote chat table")
        if getattr(settings, "DEBUG", False):
            return JsonResponse({"ok": False, "error": str(e)}, status=500)
        return JsonResponse({"ok": False, "error": "EleVote chat storage is unavailable."}, status=500)

    if request.method == "GET":
        rows = list(
            EleVoteChatMessage.objects.filter(student_id=student_id)
            .order_by("-created_at")[:30]
        )
        rows.reverse()
        return JsonResponse({"ok": True, "messages": [_elevote_message_json(row) for row in rows]})

    try:
        payload = json.loads((request.body or b"{}").decode("utf-8"))
    except Exception:
        payload = {}

    message = str(payload.get("message") or "").strip()
    if not message:
        return JsonResponse({"ok": False, "error": "Message is required."}, status=400)
    if len(message) > 2000:
        return JsonResponse({"ok": False, "error": "Message is too long."}, status=400)

    user_row = EleVoteChatMessage.objects.create(
        student_id=student_id,
        role="user",
        content=message,
    )
    try:
        reply, model = _elevote_groq_reply(student_id, message)
    except Exception as e:
        logger.exception("EleVote Groq request failed")
        reply = _elevote_fallback_reply(message)
        model = "local-fallback"

    assistant_row = EleVoteChatMessage.objects.create(
        student_id=student_id,
        role="assistant",
        content=reply,
        model=model,
    )
    return JsonResponse(
        {
            "ok": True,
            "reply": reply,
            "message": _elevote_message_json(user_row),
            "assistant_message": _elevote_message_json(assistant_row),
        }
    )


@csrf_exempt
@require_http_methods(["GET"])
def admin_app_rating_notifications_api(request):
    forbidden = _require_admin(request)
    if forbidden:
        return forbidden

    try:
        limit_raw = request.GET.get("limit", "10")
        try:
            limit = int(limit_raw)
        except Exception:
            limit = 10
        limit = max(1, min(limit, 50))

        rows = list(AppRating.objects.order_by("-created_at", "-id")[:limit])
        latest_id = rows[0].id if rows else None
        total_count = AppRating.objects.count()
        average_rating = None
        if total_count:
            from django.db.models import Avg

            average_rating = AppRating.objects.aggregate(avg=Avg("rating"))["avg"]

        notifications = [
            {
                "id": row.id,
                "student_id": row.student_id,
                "rating": row.rating,
                "label": row.label,
                "created_at": row.created_at.isoformat() if row.created_at else None,
                "title": "New app rating",
                "body": f"{row.student_id} rated the app {row.rating}/5 ({row.label}).",
            }
            for row in rows
        ]

        return JsonResponse(
            {
                "ok": True,
                "notifications": notifications,
                "latest_id": latest_id,
                "total_count": total_count,
                "average_rating": float(average_rating) if average_rating is not None else None,
            }
        )
    except Exception as e:
        if getattr(settings, "DEBUG", False):
            return JsonResponse({"ok": False, "error": str(e)}, status=500)
        return JsonResponse({"ok": False, "error": "Failed to load admin notifications."}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def account_profile_photo_api(request):
    _ensure_auth_identity_tables()

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
    _ensure_auth_identity_tables()

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
    _ensure_auth_identity_tables()

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

    _ensure_auth_identity_tables()
    _ensure_votes_tables()
    candidate_count_filter, candidate_count_params = _current_election_filter()
    vote_count_filter, vote_count_params = _current_vote_filter()

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

    total_candidates = safe_scalar(
        f"SELECT COUNT(*) FROM candidates_registration WHERE {candidate_count_filter}",
        candidate_count_params,
        default=0,
    )
    total_voters = safe_scalar("SELECT COUNT(*) FROM users WHERE role = %s", ["student"], default=0)
    total_cast_votes = safe_scalar(
        f"SELECT COUNT(*) FROM votes WHERE {vote_count_filter}",
        vote_count_params,
        default=0,
    )
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
            election["start_at"] = _iso_or_none(start_at)
            election["end_at"] = _iso_or_none(end_at)
            election["results_at"] = _iso_or_none(results_at)

            if start_at and end_at:
                now = timezone.now()
                vote_phase, _rs = _compute_election_phases(
                    now=now, start_at=start_at, end_at=end_at, results_at=results_at
                )
                if vote_phase == "upcoming":
                    election["status"] = "Upcoming"
                    election["status_class"] = "warning"
                elif vote_phase == "active":
                    election["status"] = "Active"
                    election["status_class"] = "success"
                elif vote_phase == "closed":
                    election["status"] = "Closed"
                    election["status_class"] = "danger"
    except Exception:
        pass

    recent_votes = []
    try:
        recent_where = ""
        recent_params: list[int] = []
        recent_filter, recent_params = _current_vote_filter("v")
        recent_where = f"WHERE {recent_filter}"
        with connection.cursor() as cur:
            cur.execute(
                f"""
                SELECT v.student_id AS sid, v.created_at AS voted_at,
                       s.first_name, s.middle_name, s.last_name
                FROM votes v
                LEFT JOIN student s ON s.id_number::text = v.student_id::text
                {recent_where}
                ORDER BY v.created_at DESC
                LIMIT 10
                """,
                recent_params,
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


@require_http_methods(["GET"])
def election_window_api(request):
    student_id = (request.session.get("student_id") or "").strip()
    if not student_id:
        return JsonResponse({"ok": False, "error": "Unauthorized."}, status=401)

    # Ensure notification storage exists before phase emit (fresh DB / no migrations).
    _ensure_user_notifications_table()

    election = {
        "window_id": None,
        "status": "No schedule",
        "status_class": "secondary",
        "start_at": None,
        "end_at": None,
        "results_at": None,
        "results_status": "none",
        "schedule_sig": "",
    }
    try:
        with connection.cursor() as cur:
            cur.execute("SELECT id, start_at, end_at, results_at FROM vote_windows ORDER BY id DESC LIMIT 1")
            row = cur.fetchone()

        if row:
            wid, start_at, end_at, results_at = row
            election["window_id"] = int(wid)
            election["start_at"] = _iso_or_none(start_at)
            election["end_at"] = _iso_or_none(end_at)
            election["results_at"] = _iso_or_none(results_at)
            election["schedule_sig"] = _vote_window_schedule_sig(wid, start_at, end_at, results_at)

            now = timezone.now()
            vote_phase, results_state = _compute_election_phases(
                now=now, start_at=start_at, end_at=end_at, results_at=results_at
            )
            election["results_status"] = results_state

            if vote_phase == "upcoming":
                election["status"] = "Upcoming"
                election["status_class"] = "warning"
            elif vote_phase == "active":
                election["status"] = "Active"
                election["status_class"] = "success"
            elif vote_phase == "closed":
                election["status"] = "Closed"
                election["status_class"] = "danger"
    except Exception:
        pass

    _maybe_emit_election_broadcast_notifications()
    return JsonResponse({"ok": True, "election": election})


@require_http_methods(["GET"])
def candidates_metrics_api(request):
    student_id = (request.session.get("student_id") or "").strip()
    if not student_id:
        return JsonResponse({"ok": False, "error": "Unauthorized."}, status=401)

    total_candidates = 0
    try:
        _ensure_election_scoped_tables()
        election_where, election_params = _current_election_filter()
        with connection.cursor() as cur:
            cur.execute(
                f"SELECT COUNT(*) FROM candidates_registration WHERE {election_where}",
                election_params,
            )
            row = cur.fetchone()
            if row and row[0] is not None:
                total_candidates = int(row[0])
    except Exception:
        total_candidates = 0

    return JsonResponse({"ok": True, "metrics": {"total_candidates": total_candidates}})


@require_http_methods(["GET"])
def candidates_search_api(request):
    student_id = (request.session.get("student_id") or "").strip()
    if not student_id:
        return JsonResponse({"ok": False, "error": "Unauthorized."}, status=401)

    q = (request.GET.get("q") or "").strip()
    if not q:
        return JsonResponse({"ok": True, "candidates": []})

    like = f"%{q}%"
    try:
        _ensure_election_scoped_tables()
        election_where, election_params = _current_election_filter()
        with connection.cursor() as cur:
            cur.execute(
                f"""
                SELECT id, student_id, first_name, middle_name, last_name,
                       organization, position, program, year_section,
                       photo_url, party_name, candidate_type, party_logo_url,
                       platform
                FROM candidates_registration
                WHERE {election_where}
                  AND (
                    COALESCE(first_name,'') ILIKE %s
                    OR COALESCE(middle_name,'') ILIKE %s
                    OR COALESCE(last_name,'') ILIKE %s
                    OR (COALESCE(first_name,'') || ' ' || COALESCE(middle_name,'') || ' ' || COALESCE(last_name,'')) ILIKE %s
                    OR CAST(student_id AS TEXT) ILIKE %s
                    OR COALESCE(organization,'') ILIKE %s
                    OR COALESCE(position,'') ILIKE %s
                    OR COALESCE(party_name,'') ILIKE %s
                  )
                ORDER BY organization, position, last_name, first_name
                LIMIT 80
                """,
                election_params + [like, like, like, like, like, like, like, like],
            )
            cols = [c[0] for c in cur.description]
            rows = [dict(zip(cols, r)) for r in cur.fetchall()]
        return JsonResponse({"ok": True, "candidates": rows})
    except Exception as e:
        if getattr(settings, "DEBUG", False):
            return JsonResponse({"ok": False, "error": str(e)}, status=500)
        return JsonResponse({"ok": False, "error": "Failed to search candidates."}, status=500)


@require_http_methods(["GET"])
def candidates_list_api(request):
    """Candidate rows for home strip â€” same program/org eligibility as the ballot."""
    student_id = (request.session.get("student_id") or "").strip()
    if not student_id:
        return JsonResponse({"ok": False, "error": "Unauthorized."}, status=401)

    program_code = _get_student_program_code(student_id)
    eligible_orgs = _eligible_orgs_for_program(program_code)
    allowed_rep = _usg_allowed_representative_positions(program_code)

    try:
        _ensure_election_scoped_tables()
        election_where, election_params = _current_election_filter()
        with connection.cursor() as cur:
            cur.execute(
                f"""
                SELECT id, student_id, first_name, middle_name, last_name,
                       organization, position, program, year_section,
                       photo_url, party_name, candidate_type, party_logo_url,
                       platform
                FROM candidates_registration
                WHERE UPPER(organization) = ANY(%s)
                  AND {election_where}
                ORDER BY organization, position, last_name, first_name
                LIMIT 500
                """,
                [eligible_orgs] + election_params,
            )
            cols = [c[0] for c in cur.description]
            rows = [dict(zip(cols, r)) for r in cur.fetchall()]
        out = []
        for r in rows:
            org_u = (r.get("organization") or "").upper()
            pos_u = (r.get("position") or "").upper()
            if org_u == "USG" and "REPRESENTATIVE" in pos_u:
                if not allowed_rep or not any(a in pos_u for a in allowed_rep):
                    continue
            out.append(r)
        return JsonResponse({"ok": True, "candidates": out})
    except Exception as e:
        if getattr(settings, "DEBUG", False):
            return JsonResponse({"ok": False, "error": str(e)}, status=500)
        return JsonResponse({"ok": False, "error": "Failed to load candidates."}, status=500)


@require_http_methods(["GET"])
def vote_status_api(request):
    student_id = (request.session.get("student_id") or "").strip()
    if not student_id:
        return JsonResponse({"ok": False, "error": "Unauthorized."}, status=401)

    _ensure_votes_tables()

    voted_at = None
    try:
        election_where, election_params = _current_vote_filter("votes")
        with connection.cursor() as cur:
            cur.execute(
                f"""
                SELECT created_at
                FROM votes
                WHERE student_id::text = %s
                  AND {election_where}
                ORDER BY created_at DESC
                LIMIT 1
                """,
                [student_id] + election_params,
            )
            row = cur.fetchone()
            if row:
                voted_at = row[0]
    except Exception:
        voted_at = None

    return JsonResponse(
        {
            "ok": True,
            "voted": voted_at is not None,
            "voted_at": voted_at.isoformat() if voted_at else None,
        }
    )


@require_http_methods(["GET"])
def vote_receipt_api(request):
    student_id = (request.session.get("student_id") or "").strip()
    if not student_id:
        return JsonResponse({"ok": False, "error": "Unauthorized."}, status=401)

    _ensure_votes_tables()

    try:
        with connection.cursor() as cur:
            election_where, election_params = _current_vote_filter("votes")
            # Get the most recent vote for this student
            cur.execute(
                f"""
                SELECT id, created_at
                FROM votes
                WHERE student_id::text = %s
                  AND {election_where}
                ORDER BY created_at DESC
                LIMIT 1
                """,
                [student_id] + election_params,
            )
            vote_row = cur.fetchone()
            
            if not vote_row:
                return JsonResponse({"ok": False, "error": "No vote found."}, status=404)
            
            vote_id, voted_at = vote_row
            
            # Get vote items with candidate details
            cur.execute(
                """
                SELECT vi.position, vi.candidate_id,
                       c.first_name, c.middle_name, c.last_name,
                       c.photo_url, c.party_name
                FROM vote_items vi
                JOIN candidates_registration c ON c.id = vi.candidate_id
                WHERE vi.vote_id = %s
                ORDER BY vi.position
                """,
                [vote_id],
            )
            cols = [c[0] for c in cur.description]
            vote_items = [dict(zip(cols, r)) for r in cur.fetchall()]
            
            # Build selections dictionary
            selections = {}
            candidates = {}
            
            for item in vote_items:
                position = item.get("position", "")
                candidate_id = str(item.get("candidate_id"))
                
                # Build candidate name
                name_parts = [item.get("first_name"), item.get("middle_name"), item.get("last_name")]
                candidate_name = " ".join([p for p in name_parts if p]).strip()
                
                # Store candidate info
                candidates[candidate_id] = {
                    "id": item.get("candidate_id"),
                    "name": candidate_name,
                    "photo_url": item.get("photo_url") or "",
                    "party_name": item.get("party_name") or ""
                }
                
                # Group by position
                if position not in selections:
                    selections[position] = []
                selections[position].append(item.get("candidate_id"))
            
            # Convert single selections to numbers (not arrays)
            for pos in selections:
                if len(selections[pos]) == 1:
                    selections[pos] = selections[pos][0]
            
            # Build ballot data structure for receipt
            ballot_data = {"ballot": []}
            orgs = {}
            
            for item in vote_items:
                position = item.get("position", "")
                org = position.split("::")[0] if "::" in position else "USG"
                pos_name = position.split("::")[1] if "::" in position else position
                
                if org not in orgs:
                    orgs[org] = {"organization": org, "positions": {}}
                
                if pos_name not in orgs[org]["positions"]:
                    orgs[org]["positions"][pos_name] = {"position": pos_name, "candidates": []}
            
            # Position priority for sorting (same as eligible_ballot_api)
            position_priority = [
                "PRESIDENT",
                "VICE PRESIDENT",
                "GENERAL SECRETARY",
                "ASSOCIATE SECRETARY",
                "TREASURER",
                "AUDITOR",
                "PUBLIC INFORMATION OFFICER",
                "P.I.O",
                "PIO",
            ]

            def position_sort_key(pos: str):
                up = (pos or "").strip().upper()
                normalized = (
                    up.replace("PUBLIC INFORMATION OFFICER", "PUBLIC INFORMATION OFFICER")
                    .replace("P.I.O", "PIO")
                    .replace("P. I. O", "PIO")
                )
                if "REPRESENTATIVE" in normalized:
                    return (1000, normalized)
                for i, p in enumerate(position_priority):
                    if normalized == p or normalized == p.replace("P.I.O", "PIO"):
                        return (i, normalized)
                return (500, normalized)

            org_priority = {"USG": 0, "SITE": 1, "PAFE": 2, "AFPROTECHS": 3}

            # Convert to list format with proper sorting
            for org_name in sorted(orgs.keys(), key=lambda o: (org_priority.get(o.upper(), 999), o)):
                org_data = orgs[org_name]
                positions = []
                for pos_name in sorted(org_data["positions"].keys(), key=position_sort_key):
                    positions.append(org_data["positions"][pos_name])
                ballot_data["ballot"].append({
                    "organization": org_name,
                    "positions": positions
                })
            
            return JsonResponse({
                "ok": True,
                "receipt": {
                    "reference_number": f"ELE-{vote_id}-{student_id[:8]}",
                    "voted_at": voted_at.isoformat() if voted_at else None,
                    "total_selections": len(vote_items),
                    "selections": selections,
                    "candidates": candidates,
                    "ballot_data": ballot_data
                }
            })
            
    except Exception as e:
        if getattr(settings, "DEBUG", False):
            return JsonResponse({"ok": False, "error": str(e)}, status=500)
        return JsonResponse({"ok": False, "error": "Failed to load receipt."}, status=500)


@require_http_methods(["GET"])
def eligible_ballot_api(request):
    student_id = (request.session.get("student_id") or "").strip()
    if not student_id:
        return JsonResponse({"ok": False, "error": "Unauthorized."}, status=401)

    program_code = _get_student_program_code(student_id)
    eligible_orgs = _eligible_orgs_for_program(program_code)

    try:
        _ensure_election_scoped_tables()
        election_where, election_params = _current_election_filter()
        with connection.cursor() as cur:
            cur.execute(
                f"""
                SELECT id, first_name, middle_name, last_name,
                       organization, position, program, year_section,
                       photo_url, party_name, candidate_type, party_logo_url
                FROM candidates_registration
                WHERE UPPER(organization) = ANY(%s)
                  AND {election_where}
                ORDER BY organization, position, last_name, first_name
                """,
                [eligible_orgs] + election_params,
            )
            cols = [c[0] for c in cur.description]
            rows = [dict(zip(cols, r)) for r in cur.fetchall()]
    except Exception:
        return JsonResponse({"ok": False, "error": "Failed to load ballot."}, status=500)

    grouped: dict[str, dict[str, list[dict]]] = {}
    for r in rows:
        org = (r.get("organization") or "USG").upper()
        pos = (r.get("position") or "").strip() or "Unspecified"
        grouped.setdefault(org, {}).setdefault(pos, []).append(r)

    allowed_rep = _usg_allowed_representative_positions(program_code)
    if "USG" in grouped:
        filtered_usg: dict[str, list[dict]] = {}
        for pos, arr in grouped["USG"].items():
            if "REPRESENTATIVE" in pos.upper():
                if allowed_rep and any(allowed in pos.upper() for allowed in allowed_rep):
                    filtered_usg[pos] = arr
            else:
                filtered_usg[pos] = arr
        grouped["USG"] = filtered_usg

    org_priority = {"USG": 0, "SITE": 1, "PAFE": 2, "AFPROTECHS": 3}

    position_priority = [
        "PRESIDENT",
        "VICE PRESIDENT",
        "GENERAL SECRETARY",
        "ASSOCIATE SECRETARY",
        "TREASURER",
        "AUDITOR",
        "PUBLIC INFORMATION OFFICER",
        "P.I.O",
        "PIO",
    ]

    def position_sort_key(pos: str):
        up = (pos or "").strip().upper()
        normalized = (
            up.replace("PUBLIC INFORMATION OFFICER", "PUBLIC INFORMATION OFFICER")
            .replace("P.I.O", "PIO")
            .replace("P. I. O", "PIO")
        )
        if "REPRESENTATIVE" in normalized:
            return (1000, normalized)
        for i, p in enumerate(position_priority):
            if normalized == p or normalized == p.replace("P.I.O", "PIO"):
                return (i, normalized)
        return (500, normalized)

    orgs_out = []
    for org in sorted(grouped.keys(), key=lambda o: (org_priority.get(o.upper(), 999), o)):
        pos_map = grouped[org]
        positions_out = []
        for pos in sorted(pos_map.keys(), key=position_sort_key):
            cands = []
            for x in pos_map[pos]:
                name = " ".join(
                    [p for p in [x.get("first_name"), x.get("middle_name"), x.get("last_name")] if p]
                ).strip()
                cands.append(
                    {
                        "id": x.get("id"),
                        "name": name,
                        "organization": (x.get("organization") or "").upper(),
                        "position": x.get("position") or "",
                        "program": x.get("program") or "",
                        "year_section": x.get("year_section") or "",
                        "photo_url": x.get("photo_url") or "",
                        "party_name": x.get("party_name") or "",
                        "party_logo_url": x.get("party_logo_url") or "",
                    }
                )
            positions_out.append({"position": pos, "candidates": cands})
        orgs_out.append({"organization": org, "positions": positions_out})

    return JsonResponse(
        {
            "ok": True,
            "student_id": student_id,
            "program_code": program_code,
            "eligible_organizations": eligible_orgs,
            "ballot": orgs_out,
        }
    )


def _ensure_vote_blocks_table() -> None:
    with connection.cursor() as cur:
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS vote_blocks (
                id BIGSERIAL PRIMARY KEY,
                election_id BIGINT NULL,
                vote_id BIGINT NULL,
                anonymous_voter_hash VARCHAR(128) NOT NULL,
                vote_data_hash VARCHAR(128) NOT NULL,
                previous_hash VARCHAR(128) NULL,
                current_hash VARCHAR(128) NOT NULL,
                submitted_at TIMESTAMP NOT NULL DEFAULT NOW()
            )
            """
        )
        cur.execute(
            """
            ALTER TABLE vote_blocks
            ADD COLUMN IF NOT EXISTS vote_id BIGINT NULL
            """
        )
        cur.execute(
            """
            ALTER TABLE vote_blocks
            ADD COLUMN IF NOT EXISTS block_status VARCHAR(20) NOT NULL DEFAULT 'pending'
            """
        )
        cur.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_vote_blocks_submitted
            ON vote_blocks(submitted_at DESC, id DESC)
            """
        )


def _sha256_hex(text: str) -> str:
    return hashlib.sha256((text or "").encode("utf-8")).hexdigest()


def _hash_pepper() -> str:
    """
    Server-side pepper for privacy-safe hashing.
    Flutter/clients must never control ledger hash inputs.
    """
    try:
        pepper = str(getattr(settings, "SECRET_KEY", "") or "")
    except Exception:
        pepper = ""
    return pepper or "elecom"


def _ensure_audit_logs_table() -> None:
    with connection.cursor() as cur:
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS audit_logs (
                id BIGSERIAL PRIMARY KEY,
                table_name VARCHAR(80) NOT NULL,
                record_id BIGINT NULL,
                action VARCHAR(40) NOT NULL,
                old_data JSONB NULL,
                new_data JSONB NULL,
                changed_by VARCHAR(80) NULL,
                changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """
        )
        cur.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_audit_logs_changed_at
            ON audit_logs (changed_at DESC, id DESC)
            """
        )
        cur.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_audit_logs_table_action
            ON audit_logs (table_name, action, changed_at DESC)
            """
        )


def _audit_log(
    *,
    table_name: str,
    record_id: int | None,
    action: str,
    old_data: dict | None = None,
    new_data: dict | None = None,
    changed_by: str | None = None,
) -> None:
    try:
        _ensure_audit_logs_table()
        with connection.cursor() as cur:
            cur.execute(
                """
                INSERT INTO audit_logs (
                    table_name, record_id, action, old_data, new_data, changed_by, changed_at
                )
                VALUES (%s, %s, %s, %s::jsonb, %s::jsonb, %s, NOW())
                """,
                [
                    (table_name or "")[:80],
                    int(record_id) if record_id else None,
                    (action or "")[:40],
                    json.dumps(old_data) if old_data is not None else None,
                    json.dumps(new_data) if new_data is not None else None,
                    (changed_by or "")[:80] if changed_by else None,
                ],
            )
    except Exception:
        return


def _ensure_validator_tables() -> None:
    with connection.cursor() as cur:
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS validator_nodes (
                id BIGSERIAL PRIMARY KEY,
                node_name VARCHAR(120) NOT NULL,
                node_role VARCHAR(80) NOT NULL,
                public_key TEXT NOT NULL,
                is_active BOOLEAN NOT NULL DEFAULT TRUE,
                created_at TIMESTAMP NOT NULL DEFAULT NOW()
            )
            """
        )
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS block_validations (
                id BIGSERIAL PRIMARY KEY,
                vote_block_id BIGINT NOT NULL,
                validator_node_id BIGINT NOT NULL,
                validation_status VARCHAR(20) NOT NULL,
                validation_message TEXT,
                validated_at TIMESTAMP NOT NULL DEFAULT NOW()
            )
            """
        )
        cur.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_block_validations_block
            ON block_validations(vote_block_id, validated_at DESC)
            """
        )
        # Ensure system validator nodes exist (not login accounts).
        defaults = [
            ("ELECOM Validator", "system_validator"),
            ("USG Validator", "system_validator"),
            ("Admin Validator", "system_validator"),
        ]
        for name, role in defaults:
            cur.execute(
                "SELECT id FROM validator_nodes WHERE node_name = %s LIMIT 1", [name]
            )
            existing = cur.fetchone()
            if existing and existing[0] is not None:
                cur.execute(
                    """
                    UPDATE validator_nodes
                    SET node_role = %s,
                        is_active = TRUE
                    WHERE id = %s
                    """,
                    [role, int(existing[0])],
                )
            else:
                cur.execute(
                    """
                    INSERT INTO validator_nodes (node_name, node_role, public_key, is_active, created_at)
                    VALUES (%s, %s, %s, TRUE, NOW())
                    """,
                    [name, role, _sha256_hex(f"{name}|{role}|elecom-validator")],
                )

        # Deactivate any non-system validators so consensus stays 3-of-3.
        cur.execute(
            """
            UPDATE validator_nodes
            SET is_active = FALSE
            WHERE node_name NOT IN (%s, %s, %s)
            """,
            [defaults[0][0], defaults[1][0], defaults[2][0]],
        )

        # Deactivate duplicates of system validators (keep one active row per name).
        for name, _role in defaults:
            cur.execute(
                "SELECT id FROM validator_nodes WHERE node_name = %s ORDER BY id ASC",
                [name],
            )
            ids = [int(r[0]) for r in (cur.fetchall() or []) if r and r[0] is not None]
            if not ids:
                continue
            keep_id = ids[0]
            cur.execute(
                "UPDATE validator_nodes SET is_active = TRUE WHERE id = %s",
                [keep_id],
            )
            if len(ids) > 1:
                cur.execute(
                    "UPDATE validator_nodes SET is_active = FALSE WHERE id = ANY(%s)",
                    [ids[1:]],
                )


def _iso_utc(dt_obj) -> str:
    if dt_obj is None:
        dt_obj = datetime.now(dt_timezone.utc)
    if getattr(dt_obj, "tzinfo", None) is None:
        dt_obj = dt_obj.replace(tzinfo=dt_timezone.utc)
    return dt_obj.astimezone(dt_timezone.utc).isoformat()


def _vote_data_hash_from_requested(requested: list[tuple[str, str, int]]) -> str:
    normalized = [f"{org}::{pos}::{cid}" for org, pos, cid in requested]
    normalized.sort()
    return _sha256_hex("|".join(normalized))


def _vote_data_hash_from_vote_item_rows(rows) -> str:
    requested: list[tuple[str, str, int]] = []
    for position_key, candidate_id in rows:
        raw_position = str(position_key or "").strip()
        if "::" in raw_position:
            org, pos = raw_position.split("::", 1)
        else:
            org, pos = "", raw_position
        try:
            cid = int(candidate_id)
        except (TypeError, ValueError):
            cid = 0
        requested.append((org.strip().upper(), pos.strip(), cid))
    return _vote_data_hash_from_requested(requested)


def _ensure_vote_item_change_audit_table() -> None:
    with connection.cursor() as cur:
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS vote_item_change_audit (
                id BIGSERIAL PRIMARY KEY,
                vote_id BIGINT NULL,
                vote_item_id BIGINT NULL,
                operation VARCHAR(16) NOT NULL,
                old_position VARCHAR(256) NULL,
                old_candidate_id BIGINT NULL,
                new_position VARCHAR(256) NULL,
                new_candidate_id BIGINT NULL,
                changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """
        )
        cur.execute(
            """
            CREATE INDEX IF NOT EXISTS vote_item_change_audit_vote_changed_idx
            ON vote_item_change_audit (vote_id, changed_at DESC)
            """
        )
        cur.execute(
            """
            CREATE OR REPLACE FUNCTION elecom_log_vote_item_change()
            RETURNS trigger AS $$
            BEGIN
                IF TG_OP = 'UPDATE' THEN
                    IF OLD.position IS DISTINCT FROM NEW.position
                       OR OLD.candidate_id IS DISTINCT FROM NEW.candidate_id THEN
                        INSERT INTO vote_item_change_audit (
                            vote_id, vote_item_id, operation,
                            old_position, old_candidate_id,
                            new_position, new_candidate_id,
                            changed_at
                        ) VALUES (
                            NEW.vote_id, NEW.id, TG_OP,
                            OLD.position, OLD.candidate_id,
                            NEW.position, NEW.candidate_id,
                            NOW()
                        );
                    END IF;
                    RETURN NEW;
                ELSIF TG_OP = 'DELETE' THEN
                    INSERT INTO vote_item_change_audit (
                        vote_id, vote_item_id, operation,
                        old_position, old_candidate_id,
                        changed_at
                    ) VALUES (
                        OLD.vote_id, OLD.id, TG_OP,
                        OLD.position, OLD.candidate_id,
                        NOW()
                    );
                    RETURN OLD;
                ELSIF TG_OP = 'INSERT' THEN
                    RETURN NEW;
                END IF;
                RETURN NULL;
            END;
            $$ LANGUAGE plpgsql;
            """
        )
        cur.execute(
            """
            DROP TRIGGER IF EXISTS trg_elecom_vote_item_change ON vote_items;
            CREATE TRIGGER trg_elecom_vote_item_change
            AFTER INSERT OR UPDATE OR DELETE ON vote_items
            FOR EACH ROW EXECUTE FUNCTION elecom_log_vote_item_change();
            """
        )


def _compute_expected_block_hash(
    election_id,
    anonymous_voter_hash: str,
    vote_data_hash: str,
    previous_hash: str,
    submitted_at,
) -> str:
    return _sha256_hex(
        f"{int(election_id or 0)}|{anonymous_voter_hash}|{vote_data_hash}|{previous_hash or ''}|{_iso_utc(submitted_at)}"
    )


def _current_election_id() -> int:
    try:
        with connection.cursor() as cur:
            cur.execute("SELECT id FROM vote_windows ORDER BY id DESC LIMIT 1")
            row = cur.fetchone()
        return int(row[0]) if row and row[0] is not None else 0
    except Exception:
        return 0


def _is_election_active_now() -> bool:
    try:
        with connection.cursor() as cur:
            cur.execute(
                "SELECT start_at, end_at, results_at FROM vote_windows ORDER BY id DESC LIMIT 1"
            )
            row = cur.fetchone()
        if not row:
            return False
        now = timezone.now()
        vote_phase, _results_state = _compute_election_phases(
            now=now,
            start_at=row[0],
            end_at=row[1],
            results_at=row[2],
        )
        return vote_phase == "active"
    except Exception as e:
        logger.exception("Failed to evaluate election active window: %s", e)
        return False


def _evaluate_block_checks(
    *,
    vote_data_hash: str,
    previous_hash: str,
    expected_previous_hash: str,
    current_hash: str,
    election_id: int,
    anonymous_voter_hash: str,
    submitted_at,
) -> dict:
    checks: list[tuple[bool, str, bool]] = []
    # Automatic system validators only check block integrity (no manual approval, no voter identity).
    checks.append((int(election_id or 0) > 0, "election_id is valid", False))
    checks.append(
        (
            bool((vote_data_hash or "").strip()),
            "vote_data_hash exists",
            False,
        )
    )
    checks.append(
        (
            bool((anonymous_voter_hash or "").strip()),
            "anonymous_voter_hash exists",
            False,
        )
    )
    checks.append(
        (
            (previous_hash or "") == (expected_previous_hash or ""),
            "previous_hash matches the previous block",
            True,
        )
    )

    expected_current = _compute_expected_block_hash(
        election_id=election_id,
        anonymous_voter_hash=anonymous_voter_hash,
        vote_data_hash=vote_data_hash,
        previous_hash=previous_hash,
        submitted_at=submitted_at,
    )
    checks.append((expected_current == current_hash, "current hash is correct", True))
    checks.append((expected_current == current_hash, "vote block was not tampered", True))

    failures = [msg for ok, msg, _is_hash_related in checks if not ok]
    hash_mismatch = any((not ok) and is_hash for ok, _msg, is_hash in checks)
    return {
        "approved": len(failures) == 0,
        "hash_mismatch": hash_mismatch,
        "failures": failures,
    }


@csrf_exempt
@require_http_methods(["POST"])
def vote_submit_api(request):
    student_id = (request.session.get("student_id") or "").strip()
    if not student_id:
        return JsonResponse({"ok": False, "error": "Unauthorized."}, status=401)

    # Allow voting based on eligibility checks (student record + program),
    # not purely on role. This keeps admin/test accounts functional while
    # still enforcing the privacy-safe eligibility rules below.
    _role = (request.session.get("role") or "").strip().lower()
    _ensure_face_verification_tables()

    has_active_enrollment = FaceEnrollment.objects.filter(
        student_id=student_id,
        enrollment_status="active",
    ).exists()
    if not has_active_enrollment:
        return JsonResponse(
            {"ok": False, "error": "Face enrollment is required before voting."},
            status=403,
        )

    if not _session_face_vote_valid(request, student_id):
        return JsonResponse(
            {
                "ok": False,
                "error": "Face verification required before voting. Verify your face from Elections, then try again.",
            },
            status=403,
        )

    if not _is_election_active_now():
        return JsonResponse({"ok": False, "error": "Election is not active."}, status=403)

    try:
        payload = json.loads((request.body or b"{}").decode("utf-8"))
    except Exception:
        payload = {}

    try:
        with connection.cursor() as cur:
            _ensure_network_authorization_tables(cur)
            cur.execute("SELECT COUNT(*) FROM authorized_networks WHERE LOWER(status) = 'active'")
            active_count = int((cur.fetchone() or [0])[0] or 0)
            if active_count:
                cur.execute(
                    """
                    SELECT network_ip::text, ip_prefix
                    FROM authorized_networks
                    WHERE LOWER(status) = 'active'
                    """
                )
                auth_result = _network_authorization_result(request, payload, cur.fetchall())
                allowed = auth_result["allowed"]
                user_ip = auth_result["ip"]
                ip_source = auth_result["source"]
                checked_ips = auth_result["checked"]
                message = (
                    f"Network access authorized using {ip_source} IP {user_ip}"
                    if allowed
                    else f"You must be connected to the authorized network to vote. Checked {_network_checked_ips_message(checked_ips)}."
                )
                cur.execute(
                    """
                    INSERT INTO network_access_attempts (user_id, student_id, ip_address, ssid, status, message, created_at)
                    VALUES (%s, %s, %s::inet, %s, %s, %s, CURRENT_TIMESTAMP)
                    """,
                    [None, student_id, user_ip, None, "Allowed" if allowed else "Blocked", message],
                )
                if not allowed:
                    return JsonResponse({"ok": False, "error": message}, status=403)
    except Exception as e:
        if getattr(settings, "DEBUG", False):
            return JsonResponse({"ok": False, "error": str(e)}, status=500)
        return JsonResponse({"ok": False, "error": "Failed to verify network access."}, status=500)

    selections = payload.get("selections")
    if not isinstance(selections, dict) or not selections:
        return JsonResponse({"ok": False, "error": "No selections provided."}, status=400)
    # Security: ignore any client-supplied ledger hashes/timestamps.
    # Ledger fields must be derived server-side only.
    _ensure_validator_tables()

    program_code = _get_student_program_code(student_id)
    if not program_code:
        return JsonResponse({"ok": False, "error": "Student is not eligible to vote."}, status=403)
    eligible_orgs = _eligible_orgs_for_program(program_code)
    allowed_rep = _usg_allowed_representative_positions(program_code)

    def _is_multi_select_position(org_u: str, pos: str) -> bool:
        if (org_u or "").upper() != "USG":
            return False
        return "REPRESENTATIVE" in (pos or "").upper()

    requested: list[tuple[str, str, int]] = []
    for key, cid in selections.items():
        k = str(key or "").strip()
        if "::" not in k:
            return JsonResponse({"ok": False, "error": "Invalid selection key."}, status=400)
        org, pos = [p.strip() for p in k.split("::", 1)]
        org_u = org.upper()
        if org_u not in eligible_orgs:
            return JsonResponse({"ok": False, "error": "Not eligible for this organization."}, status=403)
        if org_u == "USG" and "REPRESENTATIVE" in pos.upper():
            if not allowed_rep or not any(x in pos.upper() for x in allowed_rep):
                return JsonResponse({"ok": False, "error": "Not eligible for this position."}, status=403)

        if _is_multi_select_position(org_u, pos):
            if not isinstance(cid, list):
                return JsonResponse({"ok": False, "error": "Invalid candidate id."}, status=400)
            if len(cid) < 1 or len(cid) > 2:
                return JsonResponse({"ok": False, "error": "You may select up to 2 candidates for this position."}, status=400)
            seen: set[int] = set()
            for x in cid:
                try:
                    cid_i = int(x)
                except Exception:
                    return JsonResponse({"ok": False, "error": "Invalid candidate id."}, status=400)
                if cid_i in seen:
                    continue
                seen.add(cid_i)
                requested.append((org_u, pos, cid_i))
        else:
            if isinstance(cid, list):
                return JsonResponse({"ok": False, "error": "Invalid candidate id."}, status=400)
            try:
                cid_i = int(cid)
            except Exception:
                return JsonResponse({"ok": False, "error": "Invalid candidate id."}, status=400)
            requested.append((org_u, pos, cid_i))

    _ensure_votes_tables()

    try:
        with connection.cursor() as cur:
            cur.execute("BEGIN")

            # Enforce election window inside the transaction (server time).
            cur.execute(
                "SELECT id, start_at, end_at, results_at FROM vote_windows ORDER BY id DESC LIMIT 1"
            )
            wrow = cur.fetchone()
            if not wrow:
                cur.execute("ROLLBACK")
                return JsonResponse(
                    {"ok": False, "error": "Election schedule not set."},
                    status=403,
                )
            election_id, start_at, end_at, results_at = wrow
            if start_at is None or end_at is None:
                cur.execute("ROLLBACK")
                return JsonResponse(
                    {"ok": False, "error": "Election schedule not set."},
                    status=403,
                )
            vote_phase, _results_state = _compute_election_phases(
                now=timezone.now(),
                start_at=start_at,
                end_at=end_at,
                results_at=results_at,
            )
            if vote_phase != "active":
                cur.execute("ROLLBACK")
                return JsonResponse(
                    {"ok": False, "error": "Election is not active."},
                    status=403,
                )

            current_vote_where, current_vote_params = _current_vote_filter()
            current_vote_join_where, current_vote_join_params = _current_vote_filter("v")
            cur.execute(
                f"""
                SELECT 1
                FROM votes
                WHERE student_id::text = %s
                  AND {current_vote_where}
                LIMIT 1
                """,
                [student_id] + current_vote_params,
            )
            if cur.fetchone():
                cur.execute("ROLLBACK")
                return JsonResponse(
                    {
                        "ok": False,
                        "error": "You have already submitted your vote. You cannot vote again.",
                    },
                    status=409,
                )

            uniq_position_keys: set[str] = set()
            for org_u, pos, _cid in requested:
                uniq_position_keys.add(f"{org_u}::{pos}")

            for position_key in sorted(uniq_position_keys):
                is_rep = position_key.upper().startswith("USG::") and "REPRESENTATIVE" in position_key.upper()
                limit = 2 if is_rep else 1
                chosen = len([1 for (o, p, _c) in requested if f"{o}::{p}" == position_key])
                cur.execute(
                    f"""
                    SELECT COUNT(*)
                    FROM vote_items vi
                    JOIN votes v ON v.id = vi.vote_id
                    WHERE v.student_id::text = %s
                      AND vi.position = %s
                      AND {current_vote_join_where}
                    """,
                    [student_id, position_key] + current_vote_join_params,
                )
                row = cur.fetchone()
                already = int(row[0]) if row and row[0] is not None else 0
                if already >= limit:
                    cur.execute("ROLLBACK")
                    return JsonResponse(
                        {"ok": False, "error": f"Already voted for {position_key}."},
                        status=409,
                    )

                if chosen > limit:
                    cur.execute("ROLLBACK")
                    msg = (
                        f"You may select up to 2 candidates for {position_key}."
                        if is_rep
                        else f"You may select only 1 candidate for {position_key}."
                    )
                    return JsonResponse({"ok": False, "error": msg}, status=400)

                if already + chosen > limit:
                    cur.execute("ROLLBACK")
                    if is_rep:
                        msg = f"You can only vote {limit} time(s) for {position_key}."
                    else:
                        msg = f"Already voted for {position_key}."
                    return JsonResponse({"ok": False, "error": msg}, status=409)

            cur.execute(
                """
                INSERT INTO votes (student_id, election_id, created_at)
                VALUES (%s, %s, NOW())
                RETURNING id
                """,
                [student_id, int(election_id)],
            )
            row = cur.fetchone()
            vote_id = int(row[0]) if row and row[0] is not None else None
            if not vote_id:
                cur.execute("ROLLBACK")
                return JsonResponse({"ok": False, "error": "Failed to create vote."}, status=500)

            for org_u, pos, cid_i in requested:
                position_key = f"{org_u}::{pos}"
                candidate_election_where, candidate_election_params = _current_election_filter()
                cur.execute(
                    f"""
                    SELECT organization, position
                    FROM candidates_registration
                    WHERE id = %s
                      AND {candidate_election_where}
                    LIMIT 1
                    """,
                    [cid_i] + candidate_election_params,
                )
                cand_row = cur.fetchone()
                if not cand_row:
                    cur.execute("ROLLBACK")
                    return JsonResponse({"ok": False, "error": "Candidate not found."}, status=404)
                cand_org = (cand_row[0] or "").upper()
                cand_pos = (cand_row[1] or "").strip()
                if cand_org != org_u or cand_pos != pos:
                    cur.execute("ROLLBACK")
                    return JsonResponse({"ok": False, "error": "Candidate does not match selection."}, status=400)

                cur.execute(
                    """
                    INSERT INTO vote_items (vote_id, position, candidate_id, election_id, created_at)
                    VALUES (%s, %s, %s, %s, NOW())
                    """,
                    [vote_id, position_key, cid_i, int(election_id)],
                )

            # Write a public, privacy-safe ledger block.
            _ensure_vote_blocks_table()
            vote_data_hash = _vote_data_hash_from_requested(requested)
            anonymous_voter_hash = _sha256_hex(f"{student_id}|{vote_id}|{_hash_pepper()}")

            cur.execute(
                """
                SELECT current_hash
                FROM vote_blocks
                ORDER BY id DESC
                LIMIT 1
                """
            )
            prev_row = cur.fetchone()
            previous_hash = str(prev_row[0] or "") if prev_row and prev_row[0] is not None else ""

            submitted_at = datetime.now(dt_timezone.utc)
            current_hash = _compute_expected_block_hash(
                election_id=election_id,
                anonymous_voter_hash=anonymous_voter_hash,
                vote_data_hash=vote_data_hash,
                previous_hash=previous_hash,
                submitted_at=submitted_at,
            )

            cur.execute(
                """
                SELECT id, node_name
                FROM validator_nodes
                WHERE is_active = TRUE
                ORDER BY id ASC
                """
            )
            validators = cur.fetchall() or []
            vote_block_id = 0  # assigned after inserting vote_blocks row
            approvals = 0
            rejections = 0
            warnings = 0
            any_hash_mismatch = False
            # Since we fetch the latest current_hash earlier, this is the expected previous hash
            # for the new block we're about to insert.
            expected_previous_hash = previous_hash or ""

            validations_to_insert: list[tuple[int, str, str]] = []
            for validator_id, _node_name in validators:
                result = _evaluate_block_checks(
                    vote_data_hash=vote_data_hash,
                    previous_hash=previous_hash,
                    expected_previous_hash=expected_previous_hash,
                    current_hash=current_hash,
                    election_id=election_id,
                    anonymous_voter_hash=anonymous_voter_hash,
                    submitted_at=submitted_at,
                )
                approved = bool(result.get("approved"))
                hash_mismatch = bool(result.get("hash_mismatch"))
                failures = result.get("failures") or []
                msg = "approved" if approved else "; ".join([str(x) for x in failures])[:500]
                status = "approved" if approved else ("warning" if hash_mismatch else "rejected")
                if status == "approved":
                    approvals += 1
                elif status == "rejected":
                    rejections += 1
                else:
                    warnings += 1
                if hash_mismatch:
                    any_hash_mismatch = True
                validations_to_insert.append((int(validator_id), status, msg))

            active_nodes = len(validators)
            majority = (active_nodes // 2) + 1 if active_nodes > 0 else 1
            if any_hash_mismatch:
                block_status = "warning"
            elif approvals >= majority:
                block_status = "accepted"
            elif rejections >= majority:
                block_status = "rejected"
            else:
                block_status = "warning"

            # Insert the block ONCE with its final status (append-only).
            cur.execute(
                """
                INSERT INTO vote_blocks (
                    election_id,
                    vote_id,
                    anonymous_voter_hash,
                    vote_data_hash,
                    previous_hash,
                    current_hash,
                    submitted_at,
                    block_status
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id
                """,
                [
                    election_id if election_id > 0 else None,
                    vote_id,
                    anonymous_voter_hash,
                    vote_data_hash,
                    previous_hash or None,
                    current_hash,
                    submitted_at,
                    block_status,
                ],
            )
            block_row = cur.fetchone()
            vote_block_id = int(block_row[0]) if block_row and block_row[0] is not None else 0
            if vote_block_id <= 0:
                cur.execute("ROLLBACK")
                return JsonResponse(
                    {"ok": False, "error": "Failed to write vote ledger block."},
                    status=500,
                )

            for validator_id, status, msg in validations_to_insert:
                cur.execute(
                    """
                    INSERT INTO block_validations (
                        vote_block_id,
                        validator_node_id,
                        validation_status,
                        validation_message,
                        validated_at
                    )
                    VALUES (%s, %s, %s, %s, NOW())
                    """,
                    [vote_block_id, int(validator_id), status, msg],
                )

            cur.execute("COMMIT")
            _audit_log(
                table_name="votes",
                record_id=vote_id,
                action="vote_submitted",
                new_data={"vote_id": int(vote_id or 0), "election_id": int(election_id or 0)},
                changed_by=student_id,
            )
            _audit_log(
                table_name="vote_blocks",
                record_id=vote_block_id,
                action="vote_block_created",
                new_data={
                    "vote_block_id": int(vote_block_id or 0),
                    "election_id": int(election_id or 0),
                    "block_status": block_status,
                },
                changed_by="system",
            )
    except Exception as e:
        try:
            with connection.cursor() as cur:
                cur.execute("ROLLBACK")
        except Exception:
            pass
        if getattr(settings, "DEBUG", False):
            return JsonResponse({"ok": False, "error": str(e)}, status=500)
        return JsonResponse({"ok": False, "error": "Failed to submit vote."}, status=500)

    _clear_session_face_vote(request, student_id)
    return JsonResponse({"ok": True})


@require_http_methods(["GET"])
def vote_ledger_api(request):
    student_id = (request.session.get("student_id") or "").strip()
    if not student_id:
        return JsonResponse({"ok": False, "error": "Unauthorized."}, status=401)

    try:
        _ensure_vote_blocks_table()
        _ensure_votes_tables()
        _ensure_vote_item_change_audit_table()
        _ensure_validator_tables()
        with connection.cursor() as cur:
            cur.execute(
                """
                SELECT id, node_name
                FROM validator_nodes
                WHERE is_active = TRUE
                ORDER BY id ASC
                """
            )
            validators = cur.fetchall() or []
            active_nodes = len(validators)
            cur.execute(
                """
                SELECT id, election_id, vote_id, anonymous_voter_hash, vote_data_hash, previous_hash, current_hash, submitted_at, block_status
                FROM vote_blocks
                ORDER BY id ASC
                """
            )
            cols = [c[0] for c in cur.description]
            rows = [dict(zip(cols, r)) for r in cur.fetchall()]

            # Backfill automatic validation for older blocks that have no validations yet.
            if rows and validators:
                majority = (active_nodes // 2) + 1 if active_nodes > 0 else 1
                prev_current_hash = ""
                for r in rows:
                    block_id = int(r.get("id") or 0)
                    if block_id <= 0:
                        prev_current_hash = str(r.get("current_hash") or "")
                        continue

                    cur.execute(
                        "SELECT COUNT(*) FROM block_validations WHERE vote_block_id = %s",
                        [block_id],
                    )
                    has_any = cur.fetchone()
                    has_any_count = int(has_any[0] or 0) if has_any else 0
                    if has_any_count > 0:
                        prev_current_hash = str(r.get("current_hash") or "")
                        continue

                    approvals = 0
                    rejections = 0
                    any_hash_mismatch = False
                    for validator_id, _node_name in validators:
                        res = _evaluate_block_checks(
                            vote_data_hash=str(r.get("vote_data_hash") or ""),
                            previous_hash=str(r.get("previous_hash") or ""),
                            expected_previous_hash=prev_current_hash,
                            current_hash=str(r.get("current_hash") or ""),
                            election_id=int(r.get("election_id") or 0),
                            anonymous_voter_hash=str(r.get("anonymous_voter_hash") or ""),
                            submitted_at=r.get("submitted_at"),
                        )
                        approved = bool(res.get("approved"))
                        hash_mismatch = bool(res.get("hash_mismatch"))
                        failures = res.get("failures") or []
                        msg = "approved" if approved else "; ".join([str(x) for x in failures])[:500]
                        status = "approved" if approved else ("warning" if hash_mismatch else "rejected")
                        if status == "approved":
                            approvals += 1
                        elif status == "rejected":
                            rejections += 1
                        if hash_mismatch:
                            any_hash_mismatch = True
                        cur.execute(
                            """
                            INSERT INTO block_validations (
                                vote_block_id,
                                validator_node_id,
                                validation_status,
                                validation_message,
                                validated_at
                            )
                            VALUES (%s, %s, %s, %s, NOW())
                            """,
                            [block_id, int(validator_id), status, msg],
                        )

                    if any_hash_mismatch:
                        block_status = "warning"
                    elif approvals >= majority:
                        block_status = "accepted"
                    elif rejections >= majority:
                        block_status = "rejected"
                    else:
                        block_status = "warning"
                    cur.execute(
                        "UPDATE vote_blocks SET block_status = %s WHERE id = %s",
                        [block_status, block_id],
                    )

                    prev_current_hash = str(r.get("current_hash") or "")
                # Refresh rows after backfill updates.
                cur.execute(
                    """
                    SELECT id, election_id, vote_id, anonymous_voter_hash, vote_data_hash, previous_hash, current_hash, submitted_at, block_status
                    FROM vote_blocks
                    ORDER BY id ASC
                    """
                )
                cols = [c[0] for c in cur.description]
                rows = [dict(zip(cols, rr)) for rr in cur.fetchall()]

            # Count validations only from ACTIVE system validators, and only the latest
            # validation per (block, node) to avoid duplicates.
            cur.execute(
                """
                SELECT v.vote_block_id,
                       SUM(CASE WHEN v.validation_status = 'approved' THEN 1 ELSE 0 END) AS approved_count,
                       COUNT(*) AS total_count
                FROM (
                    SELECT DISTINCT ON (bv.vote_block_id, bv.validator_node_id)
                        bv.vote_block_id,
                        bv.validator_node_id,
                        bv.validation_status,
                        bv.validated_at
                    FROM block_validations bv
                    JOIN validator_nodes vn
                      ON vn.id = bv.validator_node_id
                     AND vn.is_active = TRUE
                    ORDER BY bv.vote_block_id, bv.validator_node_id, bv.validated_at DESC
                ) v
                GROUP BY v.vote_block_id
                """
            )
            vote_validation_counts = {
                int(r[0]): {
                    "approved": int(r[1] or 0),
                    "total": int(r[2] or 0),
                }
                for r in cur.fetchall()
            }

            vote_live_hashes: dict[int, str] = {}
            vote_change_times: dict[int, object] = {}
            vote_ids = sorted({int(r.get("vote_id") or 0) for r in rows if int(r.get("vote_id") or 0) > 0})
            if vote_ids:
                cur.execute(
                    """
                    SELECT vote_id, position, candidate_id
                    FROM vote_items
                    WHERE vote_id = ANY(%s)
                    ORDER BY vote_id ASC, position ASC, candidate_id ASC, id ASC
                    """,
                    [vote_ids],
                )
                grouped_vote_items: dict[int, list[tuple[str, int]]] = {}
                for vote_id_raw, position, candidate_id in cur.fetchall():
                    vote_id_i = int(vote_id_raw or 0)
                    grouped_vote_items.setdefault(vote_id_i, []).append((position, candidate_id))
                vote_live_hashes = {
                    vote_id_i: _vote_data_hash_from_vote_item_rows(items)
                    for vote_id_i, items in grouped_vote_items.items()
                }

                cur.execute(
                    """
                    SELECT vote_id, MAX(changed_at)
                    FROM vote_item_change_audit
                    WHERE vote_id = ANY(%s)
                    GROUP BY vote_id
                    """,
                    [vote_ids],
                )
                vote_change_times = {
                    int(vote_id_raw or 0): changed_at
                    for vote_id_raw, changed_at in cur.fetchall()
                    if int(vote_id_raw or 0) > 0
                }
    except Exception as e:
        if getattr(settings, "DEBUG", False):
            return JsonResponse({"ok": False, "error": str(e)}, status=500)
        return JsonResponse({"ok": False, "error": "Failed to load vote ledger."}, status=500)

    valid = True
    critical = False
    missing_blocks = False
    previous_current_hash = ""
    normalized_rows: list[dict] = []
    changed_vote_count = 0
    missing_vote_rows_count = 0

    # Detect missing blocks (gaps in id sequence)
    if rows:
        expected_id = int(rows[0].get("id") or 1)
        for r in rows:
            rid = int(r.get("id") or 0)
            if rid != expected_id:
                missing_blocks = True
                break
            expected_id += 1
    if missing_blocks:
        valid = False
        critical = True

    for row in rows:
        block_id = int(row.get("id") or 0)
        election_id = int(row.get("election_id") or 0)
        vote_id = int(row.get("vote_id") or 0)
        vote_data_hash = str(row.get("vote_data_hash") or "")
        live_vote_items_present = vote_id > 0 and vote_id in vote_live_hashes
        live_vote_hash = vote_live_hashes.get(vote_id, "") if live_vote_items_present else ""
        vote_changed = bool(live_vote_items_present and vote_data_hash and live_vote_hash != vote_data_hash)
        vote_rows_missing = bool(vote_id > 0 and not live_vote_items_present)
        vote_changed_at = vote_change_times.get(vote_id)
        vote_change_time_source = "audit" if vote_changed_at is not None else "detected"
        if (vote_changed or vote_rows_missing) and vote_changed_at is None:
            vote_changed_at = timezone.now()
        prev_hash = str(row.get("previous_hash") or "")
        current_hash = str(row.get("current_hash") or "")
        submitted_at = row.get("submitted_at")
        block_status = str(row.get("block_status") or "pending").lower()

        block_ok = True
        if (prev_hash or "") != (previous_current_hash or ""):
            block_ok = False

        expected_current_hash = _compute_expected_block_hash(
            election_id=election_id,
            anonymous_voter_hash=str(row.get("anonymous_voter_hash") or ""),
            vote_data_hash=vote_data_hash,
            previous_hash=prev_hash,
            submitted_at=submitted_at,
        )
        if current_hash != expected_current_hash:
            block_ok = False
        if vote_changed:
            block_ok = False
            changed_vote_count += 1
        if vote_rows_missing:
            block_ok = False
            missing_vote_rows_count += 1
        if not block_ok:
            valid = False
            critical = True

        effective_status = "valid" if block_ok else "modified"
        effective_block_status = block_status if block_ok else "modified"

        previous_current_hash = current_hash
        counts = vote_validation_counts.get(block_id, {"approved": 0, "total": 0})
        approved_count = int(counts.get("approved") or 0)
        total_validations = int(counts.get("total") or 0)
        normalized_rows.append(
            {
                # Legacy keys used by Flutter UI
                "id": block_id,
                "hash": f"{current_hash[:7]}...{current_hash[-4:]}" if len(current_hash) > 12 else current_hash,
                "hash_full": current_hash,
                "block_hash": f"{current_hash[:7]}...{current_hash[-4:]}" if len(current_hash) > 12 else current_hash,
                "block_hash_full": current_hash,
                "vote_hash": f"{vote_data_hash[:7]}...{vote_data_hash[-4:]}" if len(vote_data_hash) > 12 else vote_data_hash,
                "vote_hash_full": vote_data_hash,
                "live_vote_hash": f"{live_vote_hash[:7]}...{live_vote_hash[-4:]}" if len(live_vote_hash) > 12 else live_vote_hash,
                "live_vote_hash_full": live_vote_hash,
                "vote_changed": vote_changed,
                "vote_rows_missing": vote_rows_missing,
                "vote_changed_at": vote_changed_at.isoformat() if vote_changed_at else None,
                "vote_change_time_source": vote_change_time_source if (vote_changed or vote_rows_missing) else "",
                "tamper_indicator": "Vote changed after submission" if vote_changed else ("Vote rows missing" if vote_rows_missing else ""),
                "previous_hash": f"{prev_hash[:7]}...{prev_hash[-4:]}" if len(prev_hash) > 12 else (prev_hash or "-"),
                "previous_hash_full": prev_hash or "",
                "submitted_at": submitted_at.isoformat() if submitted_at else None,
                "status": effective_status,
                "block_status": effective_block_status,
                "node_validation_result": f"{approved_count}/{total_validations if total_validations > 0 else active_nodes} nodes approved",

                # Public transparency fields (no private vote data)
                "block_number": block_id,
                "node_approval_count": approved_count,
                "active_validator_nodes": active_nodes,
            }
        )

    total = len(normalized_rows)
    latest = normalized_rows[-1] if normalized_rows else None
    preview = list(reversed(normalized_rows[-3:]))

    if critical:
        ledger_status = "Modified"
    else:
        ledger_status = "Valid" if valid else "Warning"

    summary = {
        "ledger_status": ledger_status,
        "total_vote_blocks": total,
        "active_validator_nodes": active_nodes,
        "consensus_result": "Consensus reached"
        if (latest and latest.get("block_status") == "accepted")
        else "Consensus pending"
        if latest and latest.get("block_status") == "pending"
        else "Consensus warning",
        "latest_hash": latest.get("hash") if latest else "-",
        "last_verified": timezone.now().isoformat(),
        "latest_block_status": latest.get("block_status") if latest else "pending",
        "preview_blocks": preview,
        "missing_blocks_detected": missing_blocks,
        "changed_vote_count": changed_vote_count,
        "missing_vote_rows_count": missing_vote_rows_count,
        "vote_tampering_detected": changed_vote_count > 0 or missing_vote_rows_count > 0,
    }

    return JsonResponse(
        {
            "ok": True,
            "summary": summary,
            # Back-compat key for current Flutter UI
            "blocks": list(reversed(normalized_rows[-100:])),
            # Explicit transparency key
            "public_block_list": list(reversed(normalized_rows[-100:])),
        }
    )


@require_http_methods(["GET"])
def vote_ledger_verify_api(request):
    """
    Ledger verification endpoint (tamper detection).
    Returns verification status + issues. Does not expose private vote data.
    """
    student_id = (request.session.get("student_id") or "").strip()
    if not student_id:
        return JsonResponse({"ok": False, "error": "Unauthorized."}, status=401)

    try:
        _ensure_vote_blocks_table()
        _ensure_votes_tables()
        _ensure_vote_item_change_audit_table()
        _ensure_validator_tables()

        with connection.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM validator_nodes WHERE is_active = TRUE")
            row = cur.fetchone()
            active_nodes = int(row[0] or 0) if row else 0

            cur.execute(
                """
                SELECT id, election_id, anonymous_voter_hash, vote_data_hash,
                       previous_hash, current_hash, submitted_at, block_status
                FROM vote_blocks
                ORDER BY id ASC
                """
            )
            cols = [c[0] for c in cur.description]
            blocks = [dict(zip(cols, r)) for r in (cur.fetchall() or [])]
    except Exception as e:
        if getattr(settings, "DEBUG", False):
            return JsonResponse({"ok": False, "error": str(e)}, status=500)
        return JsonResponse({"ok": False, "error": "Failed to verify ledger."}, status=500)

    issues: list[str] = []
    critical = False

    if not blocks:
        return JsonResponse(
            {
                "ok": True,
                "ledger_status": "Warning",
                "issues": ["No blocks found."],
                "total_vote_blocks": 0,
                "active_validator_nodes": active_nodes,
                "last_verified": timezone.now().isoformat(),
            }
        )

    # Missing blocks
    expected_id = int(blocks[0].get("id") or 1)
    for b in blocks:
        bid = int(b.get("id") or 0)
        if bid != expected_id:
            issues.append(f"Missing block id(s) around #{expected_id}.")
            critical = True
            expected_id = bid
        expected_id += 1

    # Hash chain + hash computation
    prev_current = ""
    for b in blocks:
        bid = int(b.get("id") or 0)
        prev_hash = str(b.get("previous_hash") or "")
        cur_hash = str(b.get("current_hash") or "")
        if prev_hash != prev_current:
            issues.append(f"Block #{bid}: previous_hash mismatch.")
            critical = True
        expected_hash = _compute_expected_block_hash(
            election_id=int(b.get("election_id") or 0),
            anonymous_voter_hash=str(b.get("anonymous_voter_hash") or ""),
            vote_data_hash=str(b.get("vote_data_hash") or ""),
            previous_hash=prev_hash,
            submitted_at=b.get("submitted_at"),
        )
        if expected_hash != cur_hash:
            issues.append(f"Block #{bid}: current_hash mismatch.")
            critical = True
        prev_current = cur_hash

    if critical:
        ledger_status = "Critical Warning"
    elif issues:
        ledger_status = "Warning"
    else:
        ledger_status = "Valid"

    if critical:
        _audit_log(
            table_name="vote_blocks",
            record_id=None,
            action="ledger_validation_failed",
            new_data={"issues": issues[:50]},
            changed_by="system",
        )

    return JsonResponse(
        {
            "ok": True,
            "ledger_status": ledger_status,
            "issues": issues[:200],
            "total_vote_blocks": len(blocks),
            "active_validator_nodes": active_nodes,
            "last_verified": timezone.now().isoformat(),
        }
    )


def _ensure_election_final_hashes_table() -> None:
    with connection.cursor() as cur:
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS election_final_hashes (
                id BIGSERIAL PRIMARY KEY,
                election_id BIGINT NOT NULL,
                total_vote_blocks BIGINT NOT NULL,
                final_hash VARCHAR(128) NOT NULL,
                computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """
        )
        cur.execute(
            """
            CREATE UNIQUE INDEX IF NOT EXISTS ux_election_final_hashes_election_id
            ON election_final_hashes(election_id)
            """
        )


@require_http_methods(["POST"])
def admin_election_finalize_hash_api(request):
    forbid = _require_admin(request)
    if forbid:
        return forbid

    _ensure_vote_blocks_table()
    _ensure_election_final_hashes_table()

    try:
        with connection.cursor() as cur:
            cur.execute("SELECT id, start_at, end_at FROM vote_windows ORDER BY id DESC LIMIT 1")
            wrow = cur.fetchone()
            if not wrow:
                return JsonResponse({"ok": False, "error": "Election schedule not set."}, status=400)
            election_id, start_at, end_at = wrow
            if not election_id:
                return JsonResponse({"ok": False, "error": "Election schedule not set."}, status=400)
            if end_at is None:
                return JsonResponse({"ok": False, "error": "Election end time not set."}, status=400)
            now = timezone.now()
            if timezone.is_naive(end_at):
                end_at = timezone.make_aware(end_at, timezone.get_current_timezone())
            if now <= end_at:
                return JsonResponse({"ok": False, "error": "Election is still active."}, status=409)

            # Compute final hash from ordered block hashes for this election.
            cur.execute(
                """
                SELECT COUNT(*), COALESCE(string_agg(current_hash, '|' ORDER BY id), '')
                FROM vote_blocks
                WHERE COALESCE(election_id, 0) = COALESCE(%s, 0)
                """,
                [int(election_id)],
            )
            cnt, agg = cur.fetchone() or (0, "")
            cnt = int(cnt or 0)
            agg = str(agg or "")
            final_hash = _sha256_hex(f"{int(election_id)}|{cnt}|{agg}")

            cur.execute(
                """
                INSERT INTO election_final_hashes (election_id, total_vote_blocks, final_hash, computed_at)
                VALUES (%s, %s, %s, NOW())
                ON CONFLICT (election_id)
                DO UPDATE SET
                    total_vote_blocks = EXCLUDED.total_vote_blocks,
                    final_hash = EXCLUDED.final_hash,
                    computed_at = NOW()
                RETURNING id, computed_at
                """,
                [int(election_id), cnt, final_hash],
            )
            row = cur.fetchone()
            rec_id = int(row[0] or 0) if row else 0
            computed_at = row[1].isoformat() if row and row[1] else timezone.now().isoformat()

        _audit_log(
            table_name="election_final_hashes",
            record_id=rec_id if rec_id > 0 else None,
            action="final_election_hash_generated",
            new_data={
                "election_id": int(election_id),
                "total_vote_blocks": cnt,
                "final_hash": final_hash,
            },
            changed_by="admin",
        )

        return JsonResponse(
            {
                "ok": True,
                "election_id": int(election_id),
                "total_vote_blocks": cnt,
                "final_hash": final_hash,
                "computed_at": computed_at,
            }
        )
    except Exception as e:
        if getattr(settings, "DEBUG", False):
            return JsonResponse({"ok": False, "error": str(e)}, status=500)
        return JsonResponse({"ok": False, "error": "Failed to finalize election hash."}, status=500)


@require_http_methods(["GET"])
def cloudinary_signature_api(request):
    student_id = (request.session.get("student_id") or "").strip()
    if not student_id:
        return JsonResponse({"ok": False, "error": "Unauthorized."}, status=401)

    cloud_name = getattr(settings, "CLOUDINARY_CLOUD_NAME", "") or ""
    api_key = getattr(settings, "CLOUDINARY_API_KEY", "") or ""
    api_secret = getattr(settings, "CLOUDINARY_API_SECRET", "") or ""

    if not cloud_name or not api_key or not api_secret:
        return JsonResponse(
            {"ok": False, "error": "Cloudinary is not configured."},
            status=500,
        )

    upload_type = (request.GET.get("type") or "").strip() or "profile_photo"
    if upload_type not in {"profile_photo", "face_enrollment"}:
        return JsonResponse({"ok": False, "error": "Forbidden."}, status=403)

    folder = "elecom/users/photos"
    if upload_type == "face_enrollment":
        folder = "elecom/face_enrollments"

    try:
        import time
        import hashlib

        timestamp = int(time.time())
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
def face_enrollment_status_api(request):
    student_id = (request.session.get("student_id") or "").strip()
    if not student_id:
        return JsonResponse({"ok": False, "error": "Unauthorized."}, status=401)
    _ensure_face_verification_tables()
    enrollment = (
        FaceEnrollment.objects.filter(student_id=student_id, enrollment_status="active")
        .order_by("-updated_at", "-id")
        .first()
    )
    if not enrollment:
        return JsonResponse({"ok": True, "enrolled": False, "enrollment": None})
    return JsonResponse(
        {
            "ok": True,
            "enrolled": True,
            "enrollment": {
                "id": enrollment.id,
                "student_id": enrollment.student_id,
                "enrollment_status": enrollment.enrollment_status,
                "enrolled_at": enrollment.enrolled_at.isoformat() if enrollment.enrolled_at else None,
                "updated_at": enrollment.updated_at.isoformat() if enrollment.updated_at else None,
            },
        }
    )


@csrf_exempt
@require_http_methods(["POST"])
def face_enrollment_upsert_api(request):
    student_id = (request.session.get("student_id") or "").strip()
    if not student_id:
        return JsonResponse({"ok": False, "error": "Unauthorized."}, status=401)
    _ensure_face_verification_tables()
    user_id = _resolve_user_id_for_student(student_id)

    upload = _multipart_face_upload(request)
    if upload is not None:
        raw = upload.read()
        max_bytes = 8 * 1024 * 1024
        if not raw or len(raw) > max_bytes:
            return JsonResponse({"ok": False, "error": "Invalid or oversized image upload."}, status=400)
        return _save_face_enrollment_facepp(student_id, user_id, raw)

    if not _facepp_configured():
        try:
            payload = json.loads((request.body or b"{}").decode("utf-8"))
        except Exception:
            payload = {}
        face_image_url = str(payload.get("face_image_url") or "").strip()
        cloudinary_public_id = str(payload.get("cloudinary_public_id") or "").strip()
        if not face_image_url or not cloudinary_public_id:
            return JsonResponse({"ok": False, "error": "Send enrollment image as multipart field face_image."}, status=400)
        if len(face_image_url) > 2000 or len(cloudinary_public_id) > 255:
            return JsonResponse({"ok": False, "error": "Invalid face enrollment image data."}, status=400)
        try:
            with transaction.atomic():
                FaceEnrollment.objects.filter(student_id=student_id, enrollment_status="active").update(
                    enrollment_status="archived"
                )
                rec = FaceEnrollment.objects.create(
                    user_id=user_id,
                    student_id=student_id,
                    face_image_url=face_image_url,
                    cloudinary_public_id=cloudinary_public_id,
                    enrollment_status="active",
                )
            return JsonResponse(
                {
                    "ok": True,
                    "enrolled": True,
                    "enrollment": _enrollment_json(rec),
                }
            )
        except Exception as e:
            logger.exception("Legacy face enrollment failed")
            if getattr(settings, "DEBUG", False):
                return JsonResponse({"ok": False, "error": str(e)}, status=500)
            return JsonResponse({"ok": False, "error": "Failed to save face enrollment."}, status=500)

    return JsonResponse(
        {"ok": False, "error": "Send enrollment image as multipart field face_image."},
        status=400,
    )


def _enrollment_json(rec: FaceEnrollment) -> dict:
    return {
        "id": rec.id,
        "student_id": rec.student_id,
        "enrollment_status": rec.enrollment_status,
        "enrolled_at": rec.enrolled_at.isoformat() if rec.enrolled_at else None,
        "updated_at": rec.updated_at.isoformat() if rec.updated_at else None,
    }


def _save_face_enrollment_facepp(student_id: str, user_id: int | None, raw: bytes) -> JsonResponse:
    thr = getattr(settings, "FACEPP_DUPLICATE_THRESHOLD", 80.0)
    try:
        facepp_service.create_faceset_if_missing()
        new_token = facepp_service.detect_face(raw)
        try:
            results = facepp_service.search_duplicate_face(new_token)
        except facepp_service.FacePPError as e:
            # First enrollment: Face++ Search can return EMPTY_FACESET when the faceset exists
            # but has zero faces. Treat it as "no duplicate found" and proceed.
            msg = (e.message or "").strip().upper()
            if "EMPTY_FACESET" in msg:
                results = []
            else:
                raise
        for r in results:
            try:
                conf = float(r.get("confidence") or 0.0)
            except (TypeError, ValueError):
                conf = 0.0
            if conf < thr:
                continue
            matched_token = (r.get("face_token") or "").strip()
            if not matched_token:
                continue
            # Best signal: Face++ user_id (we set it to student_id on enrollment).
            rid = str(r.get("user_id") or r.get("userid") or "").strip()
            if rid and rid != student_id:
                return JsonResponse(
                    {
                        "ok": False,
                        "error": _DUP_FACE_ENROLL_MSG,
                        "code": "face_already_enrolled",
                    },
                    status=409,
                )
            owner = FaceEnrollment.objects.filter(
                enrollment_status="active",
                facepp_face_token__iexact=matched_token,
            ).first()
            if owner is not None and owner.student_id != student_id:
                return JsonResponse(
                    {
                        "ok": False,
                        "error": _DUP_FACE_ENROLL_MSG,
                        "code": "face_already_enrolled",
                    },
                    status=409,
                )

        prev = FaceEnrollment.objects.filter(student_id=student_id, enrollment_status="active").first()
        old_token = (prev.facepp_face_token or "").strip() if prev else ""

        facepp_service.add_face_to_faceset(new_token)
        try:
            facepp_service.set_face_userid(new_token, student_id)
        except Exception:
            # Non-fatal; DB token fallback still applies.
            pass
        secure_url = ""
        public_id = ""
        try:
            secure_url, public_id = upload_enrollment_image_bytes(raw)
            if len(public_id) > 255:
                public_id = public_id[:255]
        except Exception as e:
            logger.exception("Cloudinary enrollment upload failed")
            facepp_service.remove_face_from_faceset(new_token)
            msg = str(e) if getattr(settings, "DEBUG", False) else "Failed to store enrollment image."
            return JsonResponse({"ok": False, "error": msg}, status=500)

        with transaction.atomic():
            FaceEnrollment.objects.filter(student_id=student_id, enrollment_status="active").update(
                enrollment_status="archived"
            )
            rec = FaceEnrollment.objects.create(
                user_id=user_id,
                student_id=student_id,
                face_image_url=secure_url,
                cloudinary_public_id=public_id,
                facepp_face_token=new_token,
                enrollment_status="active",
            )
        if old_token and old_token != new_token:
            facepp_service.remove_face_from_faceset(old_token)
        return JsonResponse({"ok": True, "enrolled": True, "enrollment": _enrollment_json(rec)})
    except facepp_service.FacePPError as e:
        logger.warning("Face++ enrollment error: %s", e.message)
        return JsonResponse({"ok": False, "error": e.message}, status=400)
    except Exception as e:
        logger.exception("Face enrollment failed")
        if getattr(settings, "DEBUG", False):
            return JsonResponse({"ok": False, "error": str(e)}, status=500)
        return JsonResponse({"ok": False, "error": "Failed to save face enrollment."}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def face_verify_for_vote_api(request):
    return _face_verification_vote_handler(request)


@csrf_exempt
@require_http_methods(["POST"])
def face_verification_verify_api(request):
    return _face_verification_vote_handler(request)


def _face_verification_vote_handler(request) -> JsonResponse:
    student_id = (request.session.get("student_id") or "").strip()
    if not student_id:
        return JsonResponse({"ok": False, "error": "Unauthorized."}, status=401)
    _ensure_face_verification_tables()

    live_bytes = None
    liveness_ok = False
    election_override = None
    payload = {}

    upload = _multipart_face_upload(request)
    if upload is not None:
        live_bytes = upload.read()
        max_bytes = 8 * 1024 * 1024
        if not live_bytes or len(live_bytes) > max_bytes:
            live_bytes = None
        vp = getattr(request, "POST", {})
        lv = vp.get("liveness_passed", "false")
        liveness_ok = str(lv).lower() in ("1", "true", "yes", "on")
        eid_raw = vp.get("election_id")
        if eid_raw not in (None, ""):
            try:
                election_override = int(eid_raw)
            except (TypeError, ValueError):
                election_override = None
    else:
        try:
            payload = json.loads((request.body or b"{}").decode("utf-8"))
        except Exception:
            payload = {}
        liveness_ok = _post_bool(payload, "liveness_passed")
        live_face_image_url = str(payload.get("live_face_image_url") or "").strip()
        election_override = _parse_election_id_from_request(request, payload)
        if live_face_image_url:
            live_bytes = _download_public_image(live_face_image_url)

    enrollment = FaceEnrollment.objects.filter(student_id=student_id, enrollment_status="active").order_by(
        "-updated_at", "-id"
    ).first()
    election_id = election_override if election_override is not None else _active_election_id()

    verification_status = "failed"
    failure_reason = ""
    verified = False
    match_score = None

    enrolled_token = ""
    if enrollment and (enrollment.facepp_face_token or "").strip():
        enrolled_token = enrollment.facepp_face_token.strip()

    if enrollment is None:
        failure_reason = "No active enrolled face."
    elif not liveness_ok:
        failure_reason = "Blink/liveness check failed."
    elif not live_bytes:
        failure_reason = "Missing live capture."
    elif _facepp_configured():
        thr = getattr(settings, "FACEPP_VERIFY_THRESHOLD", 80.0)
        if not enrolled_token:
            failure_reason = "Face enrollment must be repeated (missing Face ID). Complete enrollment again."
        else:
            try:
                live_token = facepp_service.detect_face(live_bytes)
                conf = facepp_service.compare_faces(enrolled_token, live_token)
                match_score = Decimal(str(round(conf, 4)))
                verified = conf >= thr
                if verified:
                    verification_status = "passed"
                else:
                    failure_reason = _MISMATCH_VOTER_MSG
            except facepp_service.FacePPError as e:
                failure_reason = e.message or _MISMATCH_VOTER_MSG
            except Exception:
                logger.exception("Face++ verify unexpected error")
                failure_reason = _MISMATCH_VOTER_MSG
    else:
        live_url = str(payload.get("live_face_image_url") or "").strip()
        if live_url and enrollment is not None:
            matched, ms, compare_reason = _compare_face_urls(
                enrollment.face_image_url,
                live_url,
            )
            if ms is not None:
                match_score = Decimal(str(round(ms, 4)))
            verified = matched
            if verified:
                verification_status = "passed"
            else:
                failure_reason = compare_reason or _MISMATCH_VOTER_MSG
        else:
            failure_reason = _MISMATCH_VOTER_MSG if enrollment else "No active enrolled face."

    try:
        FaceVerificationLog.objects.create(
            student_id=student_id,
            election_id=election_id,
            liveness_status="passed" if liveness_ok else "failed",
            verification_status=verification_status,
            match_score=match_score,
            failure_reason=failure_reason or None,
        )
    except Exception as e:
        logger.exception("Face verification log write failed: %s", e)

    if verified:
        _set_session_face_vote_verified(request, student_id)
    else:
        _clear_session_face_vote(request, student_id)

    return JsonResponse(
        {
            "ok": True,
            "verified": verified,
            "allow_to_vote": verified,
            "verification_status": verification_status,
            "liveness_status": "passed" if liveness_ok else "failed",
            "failure_reason": failure_reason if not verified else "",
        }
    )


def _require_admin(request):
    role = (request.session.get("role") or "").lower()
    if role != "admin":
        return JsonResponse({"ok": False, "error": "Forbidden."}, status=403)
    return None


def _require_voters_access(request):
    forbidden = _require_admin(request)
    if forbidden:
        return forbidden

    raw = request.session.get("voters_access_verified_at")
    if not raw:
        return JsonResponse({"ok": False, "error": "Admin password required."}, status=403)

    try:
        verified_at = datetime.fromisoformat(str(raw))
        if timezone.is_naive(verified_at):
            verified_at = timezone.make_aware(verified_at, timezone.get_current_timezone())
    except Exception:
        request.session.pop("voters_access_verified_at", None)
        request.session.modified = True
        return JsonResponse({"ok": False, "error": "Admin password required."}, status=403)

    max_age_minutes = int(getattr(settings, "VOTERS_ACCESS_SESSION_MINUTES", 10) or 10)
    if timezone.now() - verified_at > timedelta(minutes=max_age_minutes):
        request.session.pop("voters_access_verified_at", None)
        request.session.modified = True
        return JsonResponse({"ok": False, "error": "Admin password expired."}, status=403)

    return None


@csrf_exempt
@require_http_methods(["GET", "POST"])
def admin_page_token_api(request):
    forbidden = _require_admin(request)
    if forbidden:
        return forbidden

    student_id = str(request.session.get("student_id") or "").strip()
    if not student_id:
        return JsonResponse({"ok": False, "error": "Unauthorized."}, status=401)

    if not request.session.session_key:
        request.session.save()

    if request.method == "POST":
        try:
            payload = json.loads((request.body or b"{}").decode("utf-8"))
        except Exception:
            payload = {}

        token = str(payload.get("token") or "").strip()
        if not token:
            return JsonResponse({"ok": False, "error": "Missing page token."}, status=400)

        try:
            data = signing.loads(
                token,
                salt=_ADMIN_PAGE_TOKEN_SALT,
                max_age=int(getattr(settings, "ADMIN_PAGE_TOKEN_SECONDS", 3600) or 3600),
            )
        except Exception:
            return JsonResponse({"ok": False, "error": "Invalid or expired page token."}, status=403)

        if (
            str(data.get("sid") or "") != student_id
            or str(data.get("role") or "").lower() != "admin"
            or str(data.get("session") or "") != str(request.session.session_key)
        ):
            return JsonResponse({"ok": False, "error": "Invalid page token."}, status=403)

        return JsonResponse({"ok": True})

    token = signing.dumps(
        {
            "sid": student_id,
            "role": "admin",
            "session": request.session.session_key,
        },
        salt=_ADMIN_PAGE_TOKEN_SALT,
        compress=True,
    )
    page = _normalize_admin_page_name(request.GET.get("page") or "admin_dashboard.html")
    route_query = {}
    for key in ("election_id", "edit_election_id"):
        value = str(request.GET.get(key) or "").strip()
        if value.isdigit():
            route_query[key] = value

    route_token = signing.dumps(
        {
            "sid": student_id,
            "role": "admin",
            "session": request.session.session_key,
            "page": page,
            "query": route_query,
        },
        salt=_ADMIN_PAGE_ROUTE_SALT,
        compress=True,
    )
    query_string = ""
    if route_query:
        from urllib.parse import urlencode
        query_string = f"?{urlencode(route_query)}"
    return JsonResponse({"ok": True, "token": token, "route_token": route_token, "secure_url": f"/g/{route_token}/{query_string}"})


@require_http_methods(["GET"])
def admin_secure_page_view(request, token):
    forbidden = _require_admin(request)
    if forbidden:
        return forbidden

    student_id = str(request.session.get("student_id") or "").strip()
    if not student_id:
        return JsonResponse({"ok": False, "error": "Unauthorized."}, status=401)

    try:
        data = signing.loads(
            str(token or ""),
            salt=_ADMIN_PAGE_ROUTE_SALT,
            max_age=int(getattr(settings, "ADMIN_PAGE_TOKEN_SECONDS", 3600) or 3600),
        )
    except Exception:
        return HttpResponse(
            '<script>window.location.href="/static/org_elecom/elecom_admin/admin_dashboard.html";</script>',
            content_type="text/html",
            status=403,
        )

    if (
        str(data.get("sid") or "") != student_id
        or str(data.get("role") or "").lower() != "admin"
        or str(data.get("session") or "") != str(request.session.session_key)
    ):
        return HttpResponse(
            '<script>window.location.href="/static/org_elecom/elecom_admin/admin_dashboard.html";</script>',
            content_type="text/html",
            status=403,
        )

    page = _normalize_admin_page_name(data.get("page") or "admin_dashboard.html")

    root = Path(settings.BASE_DIR).parent / "frontend" / "org_elecom" / "elecom_admin"
    page_path = (root / page).resolve()
    if root.resolve() not in page_path.parents or not page_path.exists():
        return JsonResponse({"ok": False, "error": "Page not found."}, status=404)

    html = _normalize_admin_html(page_path.read_text(encoding="utf-8"))
    return HttpResponse(html, content_type="text/html")


@csrf_exempt
@require_http_methods(["POST"])
def admin_verify_password_api(request):
    forbidden = _require_admin(request)
    if forbidden:
        return forbidden

    try:
        payload = json.loads((request.body or b"{}").decode("utf-8"))
    except Exception:
        payload = {}

    password = str(payload.get("password") or "").strip()
    if not password:
        return JsonResponse({"ok": False, "error": "Password is required."}, status=400)

    student_id = str(request.session.get("student_id") or "").strip()
    if not student_id:
        return JsonResponse({"ok": False, "error": "Unauthorized."}, status=401)

    try:
        with connection.cursor() as cur:
            cur.execute(
                """
                SELECT password_hash
                FROM users
                WHERE (student_id::text = %s OR id::text = %s)
                  AND COALESCE(role, '') ILIKE 'admin'
                ORDER BY CASE WHEN student_id::text = %s THEN 0 ELSE 1 END, id DESC
                LIMIT 1
                """,
                [student_id, student_id, student_id],
            )
            row = cur.fetchone()

        if not row or not _verify_password(str(row[0] or ""), password):
            return JsonResponse({"ok": False, "error": "Incorrect admin password."}, status=401)

        request.session["voters_access_verified_at"] = timezone.now().isoformat()
        request.session.modified = True
        return JsonResponse({"ok": True})
    except Exception as e:
        if getattr(settings, "DEBUG", False):
            return JsonResponse({"ok": False, "error": str(e)}, status=500)
        return JsonResponse({"ok": False, "error": "Failed to verify password."}, status=500)


BACKUP_ALLOWED_TYPES = {
    "postgres": {"label": "PostgreSQL Database", "tables": []},
    "election_records": {"label": "Election Records", "tables": ["vote_windows", "votes", "vote_items"]},
    "candidates": {"label": "Candidates", "tables": ["candidates_registration"]},
    "full_system": {"label": "Full System Backup", "tables": []},
}
BACKUP_RESTORE_SCOPES = {
    "database": "Restore database",
    "election_year": "Restore election year only",
    "candidates": "Restore candidates only",
    "reports": "Restore reports only",
}
BACKUP_SKIP_TABLES = {"admin_backups", "admin_backup_settings", "audit_logs"}


def _backup_root() -> Path:
    root = Path(getattr(settings, "ELECOM_BACKUP_DIR", "") or (Path(settings.BASE_DIR) / "backup" / "admin_backups"))
    root.mkdir(parents=True, exist_ok=True)
    return root.resolve()


def _ensure_backup_tables() -> None:
    with connection.cursor() as cur:
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS admin_backups (
                id BIGSERIAL PRIMARY KEY,
                backup_name VARCHAR(255) NOT NULL,
                backup_type VARCHAR(60) NOT NULL,
                file_path TEXT NOT NULL,
                file_size BIGINT NOT NULL DEFAULT 0,
                status VARCHAR(30) NOT NULL DEFAULT 'completed',
                created_by VARCHAR(80) NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                restored_at TIMESTAMPTZ NULL,
                notes TEXT NULL
            )
            """
        )
        cur.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_admin_backups_created_at
            ON admin_backups (created_at DESC, id DESC)
            """
        )
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS admin_backup_settings (
                id SMALLINT PRIMARY KEY DEFAULT 1,
                enabled BOOLEAN NOT NULL DEFAULT FALSE,
                frequency VARCHAR(20) NOT NULL DEFAULT 'weekly',
                updated_by VARCHAR(80) NULL,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                CHECK (id = 1)
            )
            """
        )
        cur.execute(
            """
            INSERT INTO admin_backup_settings (id)
            VALUES (1)
            ON CONFLICT (id) DO NOTHING
            """
        )


def _json_request_body(request) -> dict:
    try:
        return json.loads((request.body or b"{}").decode("utf-8"))
    except Exception:
        return {}


def _backup_db_config() -> dict:
    return settings.DATABASES.get("default", {})


def _pg_env(db: dict) -> dict:
    env = os.environ.copy()
    password = str(db.get("PASSWORD") or "")
    if password:
        env["PGPASSWORD"] = password
    return env


def _pg_base_args(db: dict) -> list[str]:
    args: list[str] = []
    host = str(db.get("HOST") or "").strip()
    port = str(db.get("PORT") or "").strip()
    user = str(db.get("USER") or "").strip()
    if host:
        args += ["--host", host]
    if port:
        args += ["--port", port]
    if user:
        args += ["--username", user]
    return args


def _postgres_identifier(name: str) -> str:
    return '"' + str(name or "").replace('"', '""') + '"'


def _postgres_literal(value) -> str:
    if value is None:
        return "NULL"
    with connection.cursor() as cur:
        return cur.mogrify("%s", [value]).decode("utf-8")


def _backup_table_names(backup_type: str) -> list[str]:
    configured = BACKUP_ALLOWED_TYPES.get(backup_type, {}).get("tables", [])
    if configured:
        return list(configured)
    with connection.cursor() as cur:
        cur.execute(
            """
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_type = 'BASE TABLE'
            ORDER BY table_name
            """
        )
        return [str(row[0]) for row in cur.fetchall() if str(row[0]) not in BACKUP_SKIP_TABLES]


def _table_columns(table_name: str) -> list[str]:
    with connection.cursor() as cur:
        cur.execute(
            """
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = %s
            ORDER BY ordinal_position
            """,
            [table_name],
        )
        return [str(row[0]) for row in cur.fetchall()]


def _run_python_sql_backup(output_path: Path, backup_type: str) -> None:
    tables = _backup_table_names(backup_type)
    with output_path.open("w", encoding="utf-8", newline="\n") as out:
        out.write("-- PostgreSQL database dump\n")
        out.write("-- ELECOM Django fallback backup\n")
        out.write(f"-- Created at: {timezone.now().isoformat()}\n")
        out.write(f"-- Backup type: {backup_type}\n\n")
        out.write("BEGIN;\n")
        if tables:
            joined = ", ".join(_postgres_identifier(table) for table in tables)
            out.write(f"TRUNCATE TABLE {joined} RESTART IDENTITY CASCADE;\n")

        for table in tables:
            columns = _table_columns(table)
            if not columns:
                continue
            quoted_table = _postgres_identifier(table)
            quoted_columns = ", ".join(_postgres_identifier(column) for column in columns)
            with connection.cursor() as cur:
                cur.execute(f"SELECT {quoted_columns} FROM {quoted_table}")
                while True:
                    rows = cur.fetchmany(500)
                    if not rows:
                        break
                    for row in rows:
                        values = ", ".join(_postgres_literal(value) for value in row)
                        out.write(f"INSERT INTO {quoted_table} ({quoted_columns}) VALUES ({values});\n")
        out.write("COMMIT;\n")


def _active_election_year() -> str:
    try:
        with connection.cursor() as cur:
            cur.execute(
                """
                SELECT COALESCE(EXTRACT(YEAR FROM start_at)::int, EXTRACT(YEAR FROM created_at)::int)
                FROM vote_windows
                ORDER BY id DESC
                LIMIT 1
                """
            )
            row = cur.fetchone()
            if row and row[0]:
                return str(int(row[0]))
    except Exception:
        return str(timezone.now().year)
    return str(timezone.now().year)


def _backup_filename(backup_type: str, ext: str) -> str:
    safe_type = "".join(ch if ch.isalnum() or ch in ("-", "_") else "_" for ch in backup_type)
    stamp = timezone.localtime(timezone.now()).strftime("%Y%m%d_%H%M%S")
    return f"elecom_{safe_type}_{_active_election_year()}_{stamp}.{ext}"


def _run_pg_dump(output_path: Path, backup_type: str) -> None:
    db = _backup_db_config()
    db_name = str(db.get("NAME") or "").strip()
    if not db_name:
        raise RuntimeError("Database name is not configured.")

    pg_dump = shutil.which("pg_dump")
    if not pg_dump:
        _run_python_sql_backup(output_path, backup_type)
        return

    command = [pg_dump, *_pg_base_args(db), "--format=plain", "--no-owner", "--no-privileges"]
    for table in BACKUP_ALLOWED_TYPES.get(backup_type, {}).get("tables", []):
        command += ["--table", table]
    command += ["--file", str(output_path), db_name]

    result = subprocess.run(
        command,
        env=_pg_env(db),
        text=True,
        capture_output=True,
        timeout=int(getattr(settings, "ELECOM_BACKUP_TIMEOUT_SECONDS", 180) or 180),
    )
    if result.returncode != 0:
        raise RuntimeError((result.stderr or result.stdout or "pg_dump failed.").strip()[:500])


def _run_psql_restore(input_path: Path) -> None:
    db = _backup_db_config()
    db_name = str(db.get("NAME") or "").strip()
    if not db_name:
        raise RuntimeError("Database name is not configured.")

    psql = shutil.which("psql")
    if not psql:
        sql_text = input_path.read_text(encoding="utf-8", errors="ignore")
        with connection.cursor() as cur:
            cur.execute(sql_text)
        return

    command = [psql, *_pg_base_args(db), "--dbname", db_name, "--file", str(input_path)]
    result = subprocess.run(
        command,
        env=_pg_env(db),
        text=True,
        capture_output=True,
        timeout=int(getattr(settings, "ELECOM_RESTORE_TIMEOUT_SECONDS", 300) or 300),
    )
    if result.returncode != 0:
        raise RuntimeError((result.stderr or result.stdout or "Restore failed.").strip()[:500])


def _record_backup(name: str, backup_type: str, file_path: Path, status: str, created_by: str, notes: str = "") -> int:
    _ensure_backup_tables()
    size = file_path.stat().st_size if file_path.exists() else 0
    with connection.cursor() as cur:
        cur.execute(
            """
            INSERT INTO admin_backups (backup_name, backup_type, file_path, file_size, status, created_by, notes)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            RETURNING id
            """,
            [name[:255], backup_type[:60], str(file_path), int(size), status[:30], created_by[:80], notes],
        )
        row = cur.fetchone()
    return int(row[0])


def _format_backup_row(row) -> dict:
    return {
        "id": int(row[0]),
        "name": row[1],
        "type": row[2],
        "type_label": BACKUP_ALLOWED_TYPES.get(row[2], {}).get("label", str(row[2] or "").replace("_", " ").title()),
        "created_at": row[3].isoformat() if row[3] else None,
        "file_size": int(row[4] or 0),
        "created_by": row[5] or "Admin",
        "status": row[6] or "completed",
        "notes": row[7] or "",
    }


@csrf_exempt
@require_http_methods(["GET"])
def admin_backup_history_api(request):
    forbidden = _require_admin(request)
    if forbidden:
        return forbidden

    _ensure_backup_tables()
    page = max(1, int(request.GET.get("page") or 1))
    page_size = min(50, max(5, int(request.GET.get("page_size") or 8)))
    offset = (page - 1) * page_size
    with connection.cursor() as cur:
        cur.execute("SELECT COUNT(*) FROM admin_backups")
        total = int(cur.fetchone()[0] or 0)
        cur.execute(
            """
            SELECT
                COUNT(*) FILTER (WHERE status = 'completed') AS completed_count,
                COUNT(*) FILTER (WHERE status = 'failed') AS failed_count,
                MAX(created_at) FILTER (WHERE status = 'completed') AS last_success_at
            FROM admin_backups
            """
        )
        stats_row = cur.fetchone() or (0, 0, None)
        cur.execute(
            """
            SELECT id, backup_name, backup_type, created_at, file_size, created_by, status, notes
            FROM admin_backups
            ORDER BY created_at DESC, id DESC
            LIMIT %s OFFSET %s
            """,
            [page_size, offset],
        )
        rows = cur.fetchall()
        cur.execute(
            """
            SELECT id, backup_name, backup_type, created_at, file_size, created_by, status, notes
            FROM admin_backups
            ORDER BY created_at DESC, id DESC
            LIMIT 1
            """
        )
        latest = cur.fetchone()

    root = _backup_root()
    used = sum(p.stat().st_size for p in root.glob("*") if p.is_file())
    return JsonResponse(
        {
            "ok": True,
            "backups": [_format_backup_row(row) for row in rows],
            "page": page,
            "page_size": page_size,
            "total": total,
            "stats": {
                "total_backups": total,
                "successful_backups": int(stats_row[0] or 0),
                "failed_backups": int(stats_row[1] or 0),
                "last_backup_time": stats_row[2].isoformat() if stats_row[2] else None,
            },
            "storage_used": used,
            "latest_backup": _format_backup_row(latest) if latest else None,
        }
    )


@csrf_exempt
@require_http_methods(["GET", "POST"])
def admin_backup_settings_api(request):
    forbidden = _require_admin(request)
    if forbidden:
        return forbidden

    _ensure_backup_tables()
    if request.method == "POST":
        payload = _json_request_body(request)
        enabled = _post_bool(payload, "enabled", False)
        frequency = str(payload.get("frequency") or "weekly").strip().lower()
        if frequency not in {"daily", "weekly", "monthly"}:
            return JsonResponse({"ok": False, "error": "Invalid backup frequency."}, status=400)
        changed_by = str(request.session.get("student_id") or "admin")
        with connection.cursor() as cur:
            cur.execute(
                """
                UPDATE admin_backup_settings
                SET enabled = %s, frequency = %s, updated_by = %s, updated_at = NOW()
                WHERE id = 1
                """,
                [enabled, frequency, changed_by],
            )
        _audit_log(table_name="admin_backups", record_id=None, action="settings", new_data=payload, changed_by=changed_by)

    with connection.cursor() as cur:
        cur.execute("SELECT enabled, frequency, updated_at FROM admin_backup_settings WHERE id = 1")
        row = cur.fetchone()
        cur.execute(
            """
            SELECT created_at
            FROM admin_backups
            WHERE status = 'completed'
            ORDER BY created_at DESC, id DESC
            LIMIT 1
            """
        )
        latest = cur.fetchone()

    enabled, frequency, updated_at = row if row else (False, "weekly", timezone.now())
    latest_at = latest[0] if latest else None
    base = latest_at or updated_at or timezone.now()
    next_delta = {"daily": timedelta(days=1), "weekly": timedelta(days=7), "monthly": timedelta(days=30)}.get(frequency, timedelta(days=7))
    return JsonResponse(
        {
            "ok": True,
            "settings": {
                "enabled": bool(enabled),
                "frequency": frequency,
                "next_scheduled_backup": (base + next_delta).isoformat() if enabled else None,
                "latest_successful_backup": latest_at.isoformat() if latest_at else None,
            },
        }
    )


@csrf_exempt
@require_http_methods(["POST"])
def admin_backup_create_api(request):
    forbidden = _require_admin(request)
    if forbidden:
        return forbidden

    payload = _json_request_body(request)
    backup_type = str(payload.get("type") or "postgres").strip().lower()
    if backup_type not in BACKUP_ALLOWED_TYPES:
        return JsonResponse({"ok": False, "error": "Invalid backup type."}, status=400)

    root = _backup_root()
    created_by = str(request.session.get("student_id") or "admin")
    ext = "zip" if backup_type == "full_system" else "sql"
    filename = _backup_filename(backup_type, ext)
    output_path = (root / filename).resolve()
    if root not in output_path.parents:
        return JsonResponse({"ok": False, "error": "Invalid backup path."}, status=400)

    try:
        if backup_type == "full_system":
            sql_name = _backup_filename("database", "sql")
            with tempfile.TemporaryDirectory() as tmp:
                sql_path = Path(tmp) / sql_name
                _run_pg_dump(sql_path, "postgres")
                manifest = {
                    "system": "ELECOM",
                    "created_at": timezone.now().isoformat(),
                    "created_by": created_by,
                    "election_year": _active_election_year(),
                    "contains": ["postgresql_database"],
                }
                with zipfile.ZipFile(output_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
                    zf.write(sql_path, arcname=sql_name)
                    zf.writestr("manifest.json", json.dumps(manifest, indent=2))
        else:
            _run_pg_dump(output_path, backup_type)

        backup_id = _record_backup(filename, backup_type, output_path, "completed", created_by)
        _audit_log(
            table_name="admin_backups",
            record_id=backup_id,
            action="create",
            new_data={"backup_name": filename, "backup_type": backup_type},
            changed_by=created_by,
        )
        return JsonResponse({"ok": True, "backup": {"id": backup_id, "name": filename, "type": backup_type}})
    except Exception as e:
        failed_path = output_path
        try:
            if failed_path.exists():
                failed_path.unlink()
        except Exception:
            pass
        _record_backup(filename, backup_type, output_path, "failed", created_by, str(e))
        return JsonResponse({"ok": False, "error": str(e)}, status=500)


@require_http_methods(["GET"])
def admin_backup_download_api(request, backup_id):
    forbidden = _require_admin(request)
    if forbidden:
        return forbidden

    _ensure_backup_tables()
    with connection.cursor() as cur:
        cur.execute("SELECT backup_name, file_path FROM admin_backups WHERE id = %s", [backup_id])
        row = cur.fetchone()
    if not row:
        return JsonResponse({"ok": False, "error": "Backup not found."}, status=404)

    root = _backup_root()
    path = Path(row[1] or "").resolve()
    if root not in path.parents or not path.exists() or not path.is_file():
        return JsonResponse({"ok": False, "error": "Backup file is missing."}, status=404)
    return FileResponse(path.open("rb"), as_attachment=True, filename=str(row[0] or path.name))


@csrf_exempt
@require_http_methods(["POST"])
def admin_backup_restore_api(request):
    forbidden = _require_admin(request)
    if forbidden:
        return forbidden

    payload = {}
    if "application/json" in (request.content_type or "").lower():
        payload = _json_request_body(request)

    password = str(request.POST.get("password") or payload.get("password") or "").strip()
    if not password:
        return JsonResponse({"ok": False, "error": "Admin password is required before restore."}, status=400)

    student_id = str(request.session.get("student_id") or "").strip()
    if not student_id:
        return JsonResponse({"ok": False, "error": "Unauthorized."}, status=401)
    try:
        with connection.cursor() as cur:
            cur.execute(
                """
                SELECT password_hash
                FROM users
                WHERE (student_id::text = %s OR id::text = %s)
                  AND COALESCE(role, '') ILIKE 'admin'
                ORDER BY CASE WHEN student_id::text = %s THEN 0 ELSE 1 END, id DESC
                LIMIT 1
                """,
                [student_id, student_id, student_id],
            )
            row = cur.fetchone()
        if not row or not _verify_password(str(row[0] or ""), password):
            return JsonResponse({"ok": False, "error": "Incorrect admin password."}, status=401)
    except Exception:
        return JsonResponse({"ok": False, "error": "Failed to verify admin password."}, status=500)

    scope = str(request.POST.get("scope") or payload.get("scope") or "database").strip().lower()
    if scope not in BACKUP_RESTORE_SCOPES:
        return JsonResponse({"ok": False, "error": "Invalid restore scope."}, status=400)
    upload = request.FILES.get("backup_file")
    backup_id = str(payload.get("backup_id") or request.POST.get("backup_id") or "").strip()
    source_path: Path | None = None
    if upload is None and backup_id.isdigit():
        _ensure_backup_tables()
        with connection.cursor() as cur:
            cur.execute("SELECT backup_name, file_path FROM admin_backups WHERE id = %s", [int(backup_id)])
            row = cur.fetchone()
        if not row:
            return JsonResponse({"ok": False, "error": "Backup not found."}, status=404)
        root = _backup_root()
        source_path = Path(row[1] or "").resolve()
        if root not in source_path.parents or not source_path.exists() or not source_path.is_file():
            return JsonResponse({"ok": False, "error": "Backup file is missing."}, status=404)
        filename = Path(str(row[0] or source_path.name)).name
    elif upload is not None:
        filename = Path(str(upload.name or "backup.sql")).name
    else:
        return JsonResponse({"ok": False, "error": "Backup file or backup ID is required."}, status=400)

    if not filename.lower().endswith((".sql", ".zip")):
        return JsonResponse({"ok": False, "error": "Only .sql and .zip backup files are supported."}, status=400)

    created_by = str(request.session.get("student_id") or "admin")
    try:
        with tempfile.TemporaryDirectory() as tmp:
            tmp_root = Path(tmp)
            upload_path = tmp_root / filename
            if upload is not None:
                with upload_path.open("wb") as dest:
                    for chunk in upload.chunks():
                        dest.write(chunk)
            else:
                shutil.copy2(source_path, upload_path)

            sql_path = upload_path
            if upload_path.suffix.lower() == ".zip":
                with zipfile.ZipFile(upload_path) as zf:
                    sql_members = [m for m in zf.namelist() if m.lower().endswith(".sql") and not m.startswith("/")]
                    if not sql_members:
                        return JsonResponse({"ok": False, "error": "Zip backup does not contain a .sql file."}, status=400)
                    zf.extract(sql_members[0], tmp_root)
                    sql_path = (tmp_root / sql_members[0]).resolve()
                    if tmp_root.resolve() not in sql_path.parents:
                        return JsonResponse({"ok": False, "error": "Invalid zip backup structure."}, status=400)

            sql_text = sql_path.read_text(encoding="utf-8", errors="ignore").lower()
            first_kb = sql_text[:2048]
            if "postgresql database dump" not in first_kb and "create table" not in first_kb and "insert into" not in first_kb:
                return JsonResponse({"ok": False, "error": "Backup validation failed."}, status=400)
            if scope != "database":
                allowed_tables = {
                    "election_year": {"vote_windows", "votes", "vote_items"},
                    "candidates": {"candidates_registration"},
                    "reports": {"votes", "vote_items"},
                }.get(scope, set())
                known_tables = {
                    "student", "users", "vote_windows", "votes", "vote_items",
                    "candidates_registration", "user_notifications", "app_ratings",
                    "authorized_networks", "network_access_attempts",
                }
                if allowed_tables and not any(table in sql_text for table in allowed_tables):
                    return JsonResponse({"ok": False, "error": "Backup does not appear to match the selected restore scope."}, status=400)
                disallowed = [table for table in known_tables - allowed_tables if table in sql_text]
                if disallowed:
                    return JsonResponse(
                        {
                            "ok": False,
                            "error": "Selected restore scope only accepts a matching table-specific backup.",
                        },
                        status=400,
                    )

            _run_psql_restore(sql_path)

        _audit_log(
            table_name="admin_backups",
            record_id=None,
            action="restore",
            new_data={"filename": filename, "scope": scope},
            changed_by=created_by,
        )
        return JsonResponse({"ok": True, "message": "Backup restored successfully."})
    except Exception as e:
        _audit_log(
            table_name="admin_backups",
            record_id=None,
            action="restore_failed",
            new_data={"filename": filename, "scope": scope, "error": str(e)},
            changed_by=created_by,
        )
        return JsonResponse({"ok": False, "error": str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST", "DELETE"])
def admin_backup_delete_api(request, backup_id):
    forbidden = _require_admin(request)
    if forbidden:
        return forbidden

    _ensure_backup_tables()
    with connection.cursor() as cur:
        cur.execute("SELECT file_path, backup_name FROM admin_backups WHERE id = %s", [backup_id])
        row = cur.fetchone()
    if not row:
        return JsonResponse({"ok": False, "error": "Backup not found."}, status=404)

    root = _backup_root()
    path = Path(row[0] or "").resolve()
    if root in path.parents and path.exists() and path.is_file():
        path.unlink()
    with connection.cursor() as cur:
        cur.execute("DELETE FROM admin_backups WHERE id = %s", [backup_id])
    changed_by = str(request.session.get("student_id") or "admin")
    _audit_log(
        table_name="admin_backups",
        record_id=int(backup_id),
        action="delete",
        old_data={"backup_name": row[1]},
        changed_by=changed_by,
    )
    return JsonResponse({"ok": True})


def _ensure_votes_tables() -> None:
    """
    Bootstrap: create `votes` and `vote_items` if missing (e.g. tables were dropped manually).
    Same pattern as _ensure_user_notifications_table â€” lets the API self-heal without re-running migrations.
    Schema aligned with elecom_voting migrations 0002/0003.
    """
    with connection.cursor() as cur:
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS votes (
                id BIGSERIAL PRIMARY KEY,
                student_id VARCHAR(64) NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """
        )
        cur.execute(
            """
            CREATE INDEX IF NOT EXISTS votes_student_id_created_at_idx
            ON votes (student_id, created_at)
            """
        )
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS vote_items (
                id BIGSERIAL PRIMARY KEY,
                vote_id BIGINT NOT NULL,
                position VARCHAR(256) NOT NULL,
                candidate_id BIGINT NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """
        )
        cur.execute(
            """
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint WHERE conname = 'fk_vote_items_vote_id'
                ) THEN
                    ALTER TABLE vote_items
                    ADD CONSTRAINT fk_vote_items_vote_id
                    FOREIGN KEY (vote_id) REFERENCES votes(id) ON DELETE CASCADE;
                END IF;
            END$$;
            """
        )
        cur.execute(
            """
            CREATE INDEX IF NOT EXISTS vote_items_position_idx ON vote_items ("position")
            """
        )
        cur.execute(
            """
            CREATE INDEX IF NOT EXISTS vote_items_candidate_id_idx ON vote_items (candidate_id)
            """
        )
        cur.execute(
            """
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint WHERE conname = 'ux_vote_items_vote_position_candidate'
                ) THEN
                    ALTER TABLE vote_items
                    ADD CONSTRAINT ux_vote_items_vote_position_candidate
                    UNIQUE (vote_id, position, candidate_id);
                END IF;
            END$$;
            """
        )
    _ensure_election_scoped_tables()


def _ensure_face_verification_tables() -> None:
    with connection.cursor() as cur:
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS face_enrollments (
                id BIGSERIAL PRIMARY KEY,
                user_id BIGINT NULL,
                student_id VARCHAR(64) NOT NULL,
                face_image_url TEXT NOT NULL,
                cloudinary_public_id VARCHAR(255) NOT NULL,
                enrollment_status VARCHAR(32) NOT NULL DEFAULT 'active',
                enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """
        )
        cur.execute(
            """
            CREATE INDEX IF NOT EXISTS face_enrollments_student_status_idx
            ON face_enrollments (student_id, enrollment_status)
            """
        )
        cur.execute(
            """
            CREATE INDEX IF NOT EXISTS face_enrollments_enrolled_at_idx
            ON face_enrollments (enrolled_at)
            """
        )
        cur.execute(
            """
            ALTER TABLE face_enrollments
            ADD COLUMN IF NOT EXISTS facepp_face_token VARCHAR(64)
            """
        )
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS face_verification_logs (
                id BIGSERIAL PRIMARY KEY,
                student_id VARCHAR(64) NOT NULL,
                election_id BIGINT NULL,
                liveness_status VARCHAR(32) NOT NULL,
                verification_status VARCHAR(32) NOT NULL,
                match_score NUMERIC(5,4) NULL,
                failure_reason TEXT NULL,
                verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """
        )
        # Face++ confidence is commonly 0â€“100; NUMERIC(5,4) cannot store values >= 10.
        # Keep it wide enough so inserts don't fail silently.
        cur.execute(
            """
            ALTER TABLE face_verification_logs
            ALTER COLUMN match_score TYPE NUMERIC(10,4)
            """
        )
        cur.execute(
            """
            CREATE INDEX IF NOT EXISTS face_verification_logs_student_verified_at_idx
            ON face_verification_logs (student_id, verified_at DESC)
            """
        )
        cur.execute(
            """
            CREATE INDEX IF NOT EXISTS face_verification_logs_election_verified_at_idx
            ON face_verification_logs (election_id, verified_at DESC)
            """
        )
        cur.execute(
            """
            CREATE INDEX IF NOT EXISTS face_verification_logs_status_idx
            ON face_verification_logs (verification_status)
            """
        )


def _resolve_user_id_for_student(student_id: str) -> int | None:
    sid = (student_id or "").strip()
    if not sid:
        return None
    with connection.cursor() as cur:
        cur.execute(
            """
            SELECT id
            FROM users
            WHERE student_id::text = %s OR id::text = %s
            ORDER BY CASE WHEN student_id::text = %s THEN 0 ELSE 1 END, id DESC
            LIMIT 1
            """,
            [sid, sid, sid],
        )
        row = cur.fetchone()
        if not row:
            return None
        try:
            return int(row[0])
        except Exception:
            return None


def _active_election_id() -> int | None:
    try:
        with connection.cursor() as cur:
            cur.execute("SELECT id FROM vote_windows ORDER BY id DESC LIMIT 1")
            row = cur.fetchone()
            return int(row[0]) if row and row[0] is not None else None
    except Exception:
        return None


def _compare_face_urls(reference_url: str, live_url: str) -> tuple[bool, float | None, str]:
    ref = (reference_url or "").strip()
    live = (live_url or "").strip()
    if not ref or not live:
        return False, None, "Missing face image URL."
    try:
        import face_recognition  # type: ignore
    except Exception:
        # Fallback matcher: avoid hard-blocking when face_recognition/dlib is unavailable.
        # This keeps flow operational using image similarity while still enforcing liveness.
        return _compare_face_urls_fallback(reference_url=ref, live_url=live)
    try:
        with tempfile.NamedTemporaryFile(suffix=".jpg", delete=True) as ref_file, tempfile.NamedTemporaryFile(
            suffix=".jpg", delete=True
        ) as live_file:
            with urllib.request.urlopen(ref, timeout=10) as res:
                ref_file.write(res.read())
                ref_file.flush()
            with urllib.request.urlopen(live, timeout=10) as res:
                live_file.write(res.read())
                live_file.flush()

            ref_img = face_recognition.load_image_file(ref_file.name)
            live_img = face_recognition.load_image_file(live_file.name)
            ref_enc = face_recognition.face_encodings(ref_img)
            live_enc = face_recognition.face_encodings(live_img)
            if not ref_enc:
                return False, None, "No face found in enrolled image."
            if not live_enc:
                return False, None, "No face found in live capture."

            distance = face_recognition.face_distance([ref_enc[0]], live_enc[0])[0]
            score = max(0.0, min(1.0, 1.0 - float(distance)))
            # Equivalent to ~0.45 max distance threshold.
            passed = score >= 0.55
            return (
                passed,
                score,
                ""
                if passed
                else "Face verification failed. This face does not match the enrolled voter.",
            )
    except Exception:
        return False, None, "Face matching failed."


def _compare_face_urls_fallback(reference_url: str, live_url: str) -> tuple[bool, float | None, str]:
    try:
        from PIL import Image, ImageOps  # type: ignore
    except Exception:
        return False, None, "Face matcher is unavailable on server."

    try:
        with urllib.request.urlopen(reference_url, timeout=10) as res:
            ref_bytes = res.read()
        with urllib.request.urlopen(live_url, timeout=10) as res:
            live_bytes = res.read()

        ref_img = Image.open(io.BytesIO(ref_bytes))
        live_img = Image.open(io.BytesIO(live_bytes))

        # Normalize to grayscale, fixed size for deterministic distance computation.
        ref_norm = ImageOps.fit(ref_img.convert("L"), (128, 128), method=Image.Resampling.BILINEAR)
        live_norm = ImageOps.fit(live_img.convert("L"), (128, 128), method=Image.Resampling.BILINEAR)

        ref_px = list(ref_norm.getdata())
        live_px = list(live_norm.getdata())
        if len(ref_px) != len(live_px) or not ref_px:
            return False, None, "Face matching failed."

        mae = sum(abs(int(a) - int(b)) for a, b in zip(ref_px, live_px)) / float(len(ref_px))
        score = max(0.0, min(1.0, 1.0 - (mae / 255.0)))

        # Conservative threshold for same-device selfie flow.
        passed = score >= 0.70
        if passed:
            return True, score, ""
        return (
            False,
            score,
            "Face verification failed. This face does not match the enrolled voter.",
        )
    except Exception:
        return False, None, "Face matching failed."


def _ensure_user_notifications_table() -> None:
    """
    Bootstrap: create `user_notifications` on first use if migrations never ran.
    Keep this helper and all call sites â€” mobile relies on the table existing.
    """
    with connection.cursor() as cur:
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS user_notifications (
                id BIGSERIAL PRIMARY KEY,
                student_id VARCHAR(64) NOT NULL,
                type VARCHAR(50),
                title VARCHAR(255) NOT NULL,
                body TEXT NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                read_at TIMESTAMP NULL,
                receipt_id BIGINT NULL,
                pinned BOOLEAN NOT NULL DEFAULT FALSE
            )
            """
        )
        cur.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_user_notifications_student_created
            ON user_notifications(student_id, created_at DESC)
            """
        )


def _iso_or_none(dt):
    if not dt:
        return None
    try:
        if timezone.is_naive(dt):
            # Election schedules are entered as Asia/Manila wall-clock values.
            dt = timezone.make_aware(dt, timezone.get_current_timezone())
        dt = dt.astimezone(timezone.get_current_timezone())
        return dt.isoformat()
    except Exception:
        try:
            return dt.isoformat()
        except Exception:
            return None


def _notification_iso_or_none(dt):
    if not dt:
        return None
    try:
        return _iso_utc(dt)
    except Exception:
        try:
            return dt.isoformat()
        except Exception:
            return None


def _election_naive_utc_from_admin_form(dt):
    """
    Admin UI sends HTML datetime-local strings as Asia/Manila wall-clock time.
    vote_windows uses `timestamp without time zone`; persist the local wall-clock
    value so mobile, admin, and submit checks all read the same schedule.
    """
    if not dt:
        return None
    try:
        if timezone.is_naive(dt):
            return dt
        return dt.astimezone(timezone.get_current_timezone()).replace(tzinfo=None)
    except Exception:
        return dt


def _election_datetime_local_for_admin_form(dt):
    """datetime-local (YYYY-MM-DDTHH:MM) for the admin form from local DB time."""
    if not dt:
        return ""
    try:
        if timezone.is_naive(dt):
            local_aw = timezone.make_aware(dt, timezone.get_current_timezone())
        else:
            local_aw = dt.astimezone(timezone.get_current_timezone())
        return local_aw.strftime("%Y-%m-%dT%H:%M")
    except Exception:
        return ""


def _ensure_election_broadcast_state_table() -> None:
    with connection.cursor() as cur:
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS election_broadcast_state (
                singleton SMALLINT PRIMARY KEY,
                window_id BIGINT NOT NULL DEFAULT 0,
                vote_phase VARCHAR(32) NOT NULL DEFAULT '',
                results_state VARCHAR(32) NOT NULL DEFAULT '',
                updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
                CONSTRAINT election_broadcast_state_singleton_chk CHECK (singleton = 1)
            )
            """
        )
        cur.execute(
            """
            ALTER TABLE election_broadcast_state
            ADD COLUMN IF NOT EXISTS schedule_sig TEXT NOT NULL DEFAULT ''
            """
        )
        cur.execute(
            """
            INSERT INTO election_broadcast_state (singleton, window_id, vote_phase, results_state)
            VALUES (1, 0, '', '')
            ON CONFLICT (singleton) DO NOTHING
            """
        )


def _vote_window_schedule_sig(window_id, start_at, end_at, results_at) -> str:
    """Stable fingerprint of the latest vote_windows row; any admin edit should change this."""

    def piece(x):
        if x is None:
            return ""
        try:
            if hasattr(x, "isoformat"):
                return x.isoformat(sep=" ", timespec="seconds")
        except Exception:
            pass
        return str(x)

    try:
        wid = int(window_id or 0)
    except Exception:
        wid = 0
    return f"{wid}|{piece(start_at)}|{piece(end_at)}|{piece(results_at)}"


def _bulk_insert_user_notifications_for_all_accounts(*, notif_type: str, title: str, body: str) -> None:
    """
    Election phase alerts go to every row in `users` (students, admins, etc.).
    `user_notifications.student_id` stores the same key the mobile session uses:
    trimmed users.student_id, or `users.id` as text when student_id is blank.
    """
    _ensure_user_notifications_table()
    with connection.cursor() as cur:
        cur.execute(
            """
            INSERT INTO user_notifications (student_id, type, title, body, created_at, read_at, receipt_id, pinned)
            SELECT DISTINCT ON (notif_key)
                notif_key, %s, %s, %s, NOW(), NULL, NULL, FALSE
            FROM (
                SELECT
                    COALESCE(NULLIF(TRIM(COALESCE(u.student_id::text, '')), ''), u.id::text) AS notif_key,
                    u.id
                FROM users u
            ) t
            ORDER BY notif_key, id DESC
            """,
            [notif_type, title, body],
        )


def _vote_window_times_aware(start_at, end_at, results_at):
    """Interpret naive DB timestamps as Asia/Manila election schedule values."""

    def aware(dt):
        if not dt:
            return None
        if timezone.is_naive(dt):
            return timezone.make_aware(dt, timezone.get_current_timezone())
        return dt.astimezone(timezone.get_current_timezone())

    return aware(start_at), aware(end_at), aware(results_at)


def _compute_election_phases(*, now, start_at, end_at, results_at):
    """Returns (vote_phase, results_state) where vote_phase in none|upcoming|active|closed."""
    s, e, r = _vote_window_times_aware(start_at, end_at, results_at)
    if not s or not e:
        return "none", "none"
    if now < s:
        vote = "upcoming"
    elif s <= now <= e:
        vote = "active"
    else:
        vote = "closed"
    if r is None:
        res = "none"
    elif now < r:
        res = "pending"
    else:
        res = "published"
    return vote, res


def _maybe_emit_election_broadcast_notifications() -> None:
    """
    When any authenticated client polls election_window_api:
    - Fan-out DB notifications on vote phase transitions (start / end / results).
    - Fan-out when the latest vote_windows row or its timestamps change (schedule update).

    True FCM to offline devices is not implemented here; mobile can poll this endpoint and show local push.
    """
    try:
        _ensure_election_broadcast_state_table()
        now = timezone.now()

        with connection.cursor() as cur:
            cur.execute("SELECT id, start_at, end_at, results_at FROM vote_windows ORDER BY id DESC LIMIT 1")
            row = cur.fetchone()
        if not row:
            return

        window_id = int(row[0] or 0)
        start_at, end_at, results_at = row[1], row[2], row[3]
        new_sig = _vote_window_schedule_sig(window_id, start_at, end_at, results_at)
        vote_phase, results_state = _compute_election_phases(now=now, start_at=start_at, end_at=end_at, results_at=results_at)

        with connection.cursor() as cur:
            cur.execute(
                """
                SELECT window_id, vote_phase, results_state, COALESCE(schedule_sig, '')
                FROM election_broadcast_state WHERE singleton = 1
                """
            )
            prev = cur.fetchone()
        if not prev:
            return

        old_wid, old_vote, old_results = int(prev[0] or 0), str(prev[1] or ""), str(prev[2] or "")
        old_sig = str(prev[3] or "")

        # First-ever sync (empty DB / fresh marker): record schedule, do not spam everyone.
        cold_start = old_wid == 0 and old_vote == "" and old_results == "" and old_sig == ""
        # New column on an existing deployment: backfill signature without notifying once.
        sig_backfill_only = old_sig == "" and old_wid != 0 and new_sig != ""

        schedule_changed = new_sig != old_sig
        if schedule_changed and not cold_start and not sig_backfill_only:
            _bulk_insert_user_notifications_for_all_accounts(
                notif_type="election",
                title="Voting schedule updated",
                body="Election dates or the active voting window were changed. Check the Home countdown for the latest schedule.",
            )

        # Phase alerts only for the same vote_windows row (avoid cross-window false positives).
        if old_wid == window_id:
            started = vote_phase == "active" and old_vote not in ("active",)
            ended = vote_phase == "closed" and old_vote == "active"
            results_out = results_state == "published" and old_results == "pending"
        else:
            started = False
            ended = False
            results_out = False

        if started:
            _bulk_insert_user_notifications_for_all_accounts(
                notif_type="election",
                title="Voting has started",
                body="The voting window is now open. Cast your vote before it closes.",
            )
        if ended:
            _bulk_insert_user_notifications_for_all_accounts(
                notif_type="election",
                title="Voting has ended",
                body="The voting window is now closed. Thank you for participating.",
            )
        if results_out:
            _bulk_insert_user_notifications_for_all_accounts(
                notif_type="results",
                title="Results are available",
                body="Election results are now published. Check the Results section in the app.",
            )

        with connection.cursor() as cur:
            cur.execute(
                """
                UPDATE election_broadcast_state
                SET window_id = %s, vote_phase = %s, results_state = %s, schedule_sig = %s, updated_at = NOW()
                WHERE singleton = 1
                """,
                [window_id, vote_phase, results_state, new_sig],
            )
    except Exception:
        pass


@require_http_methods(["GET"])
def user_notifications_list_api(request):
    student_id = (request.session.get("student_id") or "").strip()
    if not student_id:
        return JsonResponse({"ok": False, "error": "Unauthorized."}, status=401)

    try:
        _ensure_user_notifications_table()
        with connection.cursor() as cur:
            cur.execute(
                """
                SELECT id, student_id, type, title, body, created_at, read_at, receipt_id, pinned
                FROM user_notifications
                WHERE student_id::text = %s
                ORDER BY created_at DESC, id DESC
                LIMIT 200
                """,
                [student_id],
            )
            cols = [c[0] for c in cur.description]
            rows = [dict(zip(cols, r)) for r in cur.fetchall()]

        out = []
        for row in rows:
            out.append(
                {
                    "id": int(row["id"]),
                    "student_id": str(row.get("student_id") or ""),
                    "type": (row.get("type") or "").strip(),
                    "title": (row.get("title") or "").strip(),
                    "body": (row.get("body") or "").strip(),
                    "created_at": _notification_iso_or_none(row.get("created_at")),
                    "read_at": _notification_iso_or_none(row.get("read_at")),
                    "receipt_id": row.get("receipt_id"),
                    "pinned": bool(row.get("pinned") or False),
                }
            )

        unread = sum(1 for x in out if not x.get("read_at"))
        return JsonResponse({"ok": True, "notifications": out, "unread_count": unread})
    except Exception as e:
        if getattr(settings, "DEBUG", False):
            return JsonResponse({"ok": False, "error": str(e)}, status=500)
        return JsonResponse({"ok": False, "error": "Failed to load notifications."}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def user_notifications_create_api(request):
    student_id = (request.session.get("student_id") or "").strip()
    if not student_id:
        return JsonResponse({"ok": False, "error": "Unauthorized."}, status=401)

    try:
        payload = json.loads((request.body or b"{}").decode("utf-8"))
    except Exception:
        payload = {}

    title = str(payload.get("title") or "").strip()
    body = str(payload.get("body") or "").strip()
    notif_type = str(payload.get("type") or "general").strip() or "general"
    pinned = bool(payload.get("pinned") or False)
    receipt_raw = payload.get("receipt_id")

    if not title or not body:
        return JsonResponse({"ok": False, "error": "Missing notification content."}, status=400)

    receipt_id = None
    if receipt_raw is not None and str(receipt_raw).strip():
        try:
            receipt_id = int(receipt_raw)
        except Exception:
            return JsonResponse({"ok": False, "error": "Invalid receipt id."}, status=400)

    try:
        _ensure_user_notifications_table()
        with connection.cursor() as cur:
            cur.execute(
                """
                INSERT INTO user_notifications (
                    student_id, type, title, body, receipt_id, pinned, created_at
                )
                VALUES (%s, %s, %s, %s, %s, %s, NOW())
                RETURNING id, student_id, type, title, body, created_at, read_at, receipt_id, pinned
                """,
                [student_id, notif_type, title, body, receipt_id, pinned],
            )
            row = cur.fetchone()
            cols = [c[0] for c in cur.description]
            created = dict(zip(cols, row)) if row else {}

        notif = {
            "id": int(created.get("id") or 0),
            "student_id": str(created.get("student_id") or ""),
            "type": (created.get("type") or "").strip(),
            "title": (created.get("title") or "").strip(),
            "body": (created.get("body") or "").strip(),
            "created_at": _notification_iso_or_none(created.get("created_at")),
            "read_at": _notification_iso_or_none(created.get("read_at")),
            "receipt_id": created.get("receipt_id"),
            "pinned": bool(created.get("pinned") or False),
        }
        return JsonResponse({"ok": True, "notification": notif})
    except Exception as e:
        if getattr(settings, "DEBUG", False):
            return JsonResponse({"ok": False, "error": str(e)}, status=500)
        return JsonResponse({"ok": False, "error": "Failed to create notification."}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def user_notifications_mark_read_api(request):
    student_id = (request.session.get("student_id") or "").strip()
    if not student_id:
        return JsonResponse({"ok": False, "error": "Unauthorized."}, status=401)

    try:
        payload = json.loads((request.body or b"{}").decode("utf-8"))
    except Exception:
        payload = {}

    raw_id = payload.get("id")
    try:
        notif_id = int(raw_id)
    except Exception:
        return JsonResponse({"ok": False, "error": "Invalid notification id."}, status=400)

    try:
        _ensure_user_notifications_table()
        with connection.cursor() as cur:
            cur.execute(
                """
                UPDATE user_notifications
                SET read_at = COALESCE(read_at, NOW())
                WHERE id = %s AND student_id::text = %s
                """,
                [notif_id, student_id],
            )
        return JsonResponse({"ok": True})
    except Exception as e:
        if getattr(settings, "DEBUG", False):
            return JsonResponse({"ok": False, "error": str(e)}, status=500)
        return JsonResponse({"ok": False, "error": "Failed to mark notification as read."}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def user_notifications_mark_all_read_api(request):
    student_id = (request.session.get("student_id") or "").strip()
    if not student_id:
        return JsonResponse({"ok": False, "error": "Unauthorized."}, status=401)

    try:
        _ensure_user_notifications_table()
        with connection.cursor() as cur:
            cur.execute(
                """
                UPDATE user_notifications
                SET read_at = COALESCE(read_at, NOW())
                WHERE student_id::text = %s
                """,
                [student_id],
            )
        return JsonResponse({"ok": True})
    except Exception as e:
        if getattr(settings, "DEBUG", False):
            return JsonResponse({"ok": False, "error": str(e)}, status=500)
        return JsonResponse({"ok": False, "error": "Failed to mark all notifications as read."}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def user_notifications_mark_unread_api(request):
    student_id = (request.session.get("student_id") or "").strip()
    if not student_id:
        return JsonResponse({"ok": False, "error": "Unauthorized."}, status=401)

    try:
        payload = json.loads((request.body or b"{}").decode("utf-8"))
    except Exception:
        payload = {}

    raw_id = payload.get("id")
    try:
        notif_id = int(raw_id)
    except Exception:
        return JsonResponse({"ok": False, "error": "Invalid notification id."}, status=400)

    try:
        _ensure_user_notifications_table()
        with connection.cursor() as cur:
            cur.execute(
                """
                UPDATE user_notifications
                SET read_at = NULL
                WHERE id = %s AND student_id::text = %s
                """,
                [notif_id, student_id],
            )
        return JsonResponse({"ok": True})
    except Exception as e:
        if getattr(settings, "DEBUG", False):
            return JsonResponse({"ok": False, "error": str(e)}, status=500)
        return JsonResponse({"ok": False, "error": "Failed to mark notification as unread."}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def user_notifications_pin_api(request):
    student_id = (request.session.get("student_id") or "").strip()
    if not student_id:
        return JsonResponse({"ok": False, "error": "Unauthorized."}, status=401)

    try:
        payload = json.loads((request.body or b"{}").decode("utf-8"))
    except Exception:
        payload = {}

    raw_id = payload.get("id")
    try:
        notif_id = int(raw_id)
    except Exception:
        return JsonResponse({"ok": False, "error": "Invalid notification id."}, status=400)

    pinned = bool(payload.get("pinned") or False)

    try:
        _ensure_user_notifications_table()
        with connection.cursor() as cur:
            cur.execute(
                """
                UPDATE user_notifications
                SET pinned = %s
                WHERE id = %s AND student_id::text = %s
                """,
                [pinned, notif_id, student_id],
            )
        return JsonResponse({"ok": True, "pinned": pinned})
    except Exception as e:
        if getattr(settings, "DEBUG", False):
            return JsonResponse({"ok": False, "error": str(e)}, status=500)
        return JsonResponse({"ok": False, "error": "Failed to update pinned status."}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def user_notifications_delete_api(request):
    student_id = (request.session.get("student_id") or "").strip()
    if not student_id:
        return JsonResponse({"ok": False, "error": "Unauthorized."}, status=401)

    try:
        payload = json.loads((request.body or b"{}").decode("utf-8"))
    except Exception:
        payload = {}

    raw_id = payload.get("id")
    try:
        notif_id = int(raw_id)
    except Exception:
        return JsonResponse({"ok": False, "error": "Invalid notification id."}, status=400)

    try:
        _ensure_user_notifications_table()
        with connection.cursor() as cur:
            cur.execute(
                """
                DELETE FROM user_notifications
                WHERE id = %s AND student_id::text = %s
                """,
                [notif_id, student_id],
            )
        return JsonResponse({"ok": True})
    except Exception as e:
        if getattr(settings, "DEBUG", False):
            return JsonResponse({"ok": False, "error": str(e)}, status=500)
        return JsonResponse({"ok": False, "error": "Failed to delete notification."}, status=500)


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

    _ensure_election_scoped_tables()
    election_where, election_params = _current_election_filter()
    where_parts = [election_where]
    params = list(election_params)
    if q:
        where_parts.append(
            "((COALESCE(first_name,'') || ' ' || COALESCE(middle_name,'') || ' ' || COALESCE(last_name,'')) ILIKE %s "
            "OR CAST(student_id AS TEXT) ILIKE %s "
            "OR COALESCE(position,'') ILIKE %s "
            "OR COALESCE(organization,'') ILIKE %s "
            "OR COALESCE(party_name,'') ILIKE %s)"
        )
        like = f"%{q}%"
        params.extend([like, like, like, like, like])
    where = "WHERE " + " AND ".join(where_parts)

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
        _ensure_election_scoped_tables()
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
    allow_existing = _post_bool(payload, "allow_existing", False)

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
        _ensure_election_scoped_tables()
        election_id = _active_election_id()
        with connection.cursor() as cur:
            if allow_existing:
                cur.execute(
                    """
                    SELECT id
                    FROM candidates_registration
                    WHERE COALESCE(election_id, %s) = %s
                      AND student_id::text = %s
                      AND position = %s
                    ORDER BY id DESC
                    LIMIT 1
                    """,
                    [
                        int(election_id) if election_id is not None else 0,
                        int(election_id) if election_id is not None else 0,
                        student_id,
                        position,
                    ],
                )
                existing = cur.fetchone()
                if existing:
                    return JsonResponse(
                        {
                            "ok": True,
                            "id": int(existing[0]),
                            "skipped": True,
                            "message": "Candidate already exists; skipped.",
                        }
                    )

            cur.execute(
                """
                INSERT INTO candidates_registration (
                    student_id, first_name, middle_name, last_name,
                    organization, position, program, year_section,
                    platform, photo_url, party_name, candidate_type, party_logo_url, election_id
                )
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
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
                    int(election_id) if election_id is not None else None,
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


def _hash_default_voter_password(id_number: str) -> str:
    import bcrypt

    password = str(id_number or "").strip()
    rounds = int(getattr(settings, "IMPORT_DEFAULT_PASSWORD_BCRYPT_ROUNDS", 8) or 8)
    rounds = max(4, min(rounds, 12))
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(rounds=rounds)).decode("utf-8")


def _safe_int_or_none(value):
    try:
        text = str(value or "").strip()
        if not text:
            return None
        return int(text)
    except Exception:
        return None


def _validate_voter_payload(payload: dict) -> str:
    id_number = str(payload.get("id_number") or payload.get("student_id") or "").strip()
    if not id_number:
        return "Missing ID Number."
    id_parts = id_number.split("-")
    if (
        any(not part for part in id_parts)
        or any(not part.isalnum() for part in id_parts)
    ):
        return "ID Number may contain letters, numbers, and hyphens only."

    missing = []
    if not str(payload.get("first_name") or "").strip():
        missing.append("First Name")
    if not str(payload.get("last_name") or "").strip():
        missing.append("Last Name")
    if not str(payload.get("course") or payload.get("department") or "").strip():
        missing.append("Course")
    if _safe_int_or_none(payload.get("year") or payload.get("year_level")) is None:
        missing.append("Year")
    if not str(payload.get("section") or "").strip():
        missing.append("Section")
    if not str(payload.get("email") or "").strip():
        missing.append("Email")
    if not str(payload.get("phone_number") or payload.get("phone") or "").strip():
        missing.append("Phone Number")
    if missing:
        return f"Missing {', '.join(missing)}."
    return ""


def _upsert_voter_row(cur, payload: dict) -> str:
    id_number = str(payload.get("id_number") or payload.get("student_id") or "").strip()
    err = _validate_voter_payload(payload)
    if err:
        return err

    first_name = str(payload.get("first_name") or "").strip()
    middle_name = str(payload.get("middle_name") or "").strip()
    last_name = str(payload.get("last_name") or "").strip()
    course = str(payload.get("course") or payload.get("department") or "").strip()
    year = _safe_int_or_none(payload.get("year") or payload.get("year_level"))
    section = str(payload.get("section") or "").strip()
    email = str(payload.get("email") or "").strip()
    phone = str(payload.get("phone_number") or payload.get("phone") or "").strip()
    role = str(payload.get("role") or "student").strip() or "student"
    position = str(payload.get("position") or "").strip() or None
    photo_url = str(payload.get("photo_url") or "").strip() or None

    password_hash = _hash_default_voter_password(id_number)

    cur.execute(
        """
        UPDATE student
        SET first_name = %s,
            middle_name = %s,
            last_name = %s,
            course = %s,
            year = %s,
            section = %s,
            email = %s,
            phone_number = %s,
            role = %s
        WHERE id_number::text = %s
        """,
        [first_name, middle_name, last_name, course, year, section, email, phone, role, id_number],
    )
    if cur.rowcount == 0:
        cur.execute(
            """
            INSERT INTO student (
                id_number, first_name, middle_name, last_name,
                course, year, section, email, phone_number, role
            )
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            """,
            [id_number, first_name, middle_name, last_name, course, year, section, email, phone, role],
        )

    cur.execute(
        """
        UPDATE users
        SET student_id = %s,
            password_hash = %s,
            role = %s,
            department = %s,
            year_level = %s,
            section = %s,
            position = %s,
            phone = %s,
            email = %s,
            first_name = %s,
            middle_name = %s,
            last_name = %s,
            photo_url = COALESCE(%s, photo_url)
        WHERE student_id::text = %s
        """,
        [
            id_number,
            password_hash,
            role,
            course,
            year,
            section,
            position,
            phone,
            email,
            first_name,
            middle_name,
            last_name,
            photo_url,
            id_number,
        ],
    )
    if cur.rowcount == 0:
        cur.execute(
            """
            INSERT INTO users (
                id, student_id, password_hash, created_at, role,
                department, year_level, section, position, phone, email,
                first_name, middle_name, last_name, photo_url
            )
            VALUES (
                (SELECT COALESCE(MAX(id), 0) + 1 FROM users),
                %s,
                %s,
                CURRENT_TIMESTAMP,
                %s,
                %s,
                %s,
                %s,
                %s,
                %s,
                %s,
                %s,
                %s,
                %s,
                %s
            )
            """,
            [
                id_number,
                password_hash,
                role,
                course,
                year,
                section,
                position,
                phone,
                email,
                first_name,
                middle_name,
                last_name,
                photo_url,
            ],
        )

    return ""


@require_http_methods(["GET"])
def admin_voters_list_api(request):
    _ensure_auth_identity_tables()

    forbidden = _require_voters_access(request)
    if forbidden:
        return forbidden

    q = (request.GET.get("q") or "").strip()
    where = "WHERE COALESCE(u.role, '') ILIKE 'student'"
    params = []
    if q:
        where += """
            AND (
                COALESCE(u.student_id::text, s.id_number::text, '') ILIKE %s
                OR COALESCE(s.first_name, u.first_name, '') ILIKE %s
                OR COALESCE(s.middle_name, u.middle_name, '') ILIKE %s
                OR COALESCE(s.last_name, u.last_name, '') ILIKE %s
                OR COALESCE(s.course, u.department, '') ILIKE %s
                OR COALESCE(s.email, u.email, '') ILIKE %s
                OR COALESCE(s.phone_number, u.phone, '') ILIKE %s
            )
        """
        like = f"%{q}%"
        params = [like, like, like, like, like, like, like]

    try:
        with connection.cursor() as cur:
            cur.execute(
                f"""
                SELECT
                    u.student_id::text AS id_number,
                    COALESCE(s.first_name, u.first_name, '') AS first_name,
                    COALESCE(s.middle_name, u.middle_name, '') AS middle_name,
                    COALESCE(s.last_name, u.last_name, '') AS last_name,
                    COALESCE(s.course, u.department, '') AS course,
                    COALESCE(s.year, u.year_level) AS year,
                    COALESCE(s.section, u.section, '') AS section,
                    COALESCE(s.email, u.email, '') AS email,
                    COALESCE(s.phone_number, u.phone, '') AS phone_number,
                    COALESCE(u.role, s.role, 'student') AS role,
                    COALESCE(u.position, '') AS position,
                    COALESCE(u.photo_url, '') AS photo_url,
                    u.terms_accepted_at,
                    u.created_at
                FROM users u
                LEFT JOIN student s
                  ON s.id_number::text = u.student_id::text
                {where}
                ORDER BY COALESCE(s.course, u.department, ''), COALESCE(s.year, u.year_level), COALESCE(s.section, u.section, ''), COALESCE(s.last_name, u.last_name, '')
                LIMIT 2000
                """,
                params,
            )
            cols = [c[0] for c in cur.description]
            rows = [dict(zip(cols, row)) for row in cur.fetchall()]

        for row in rows:
            row["id_number"] = str(row.get("id_number") or "")
            row["year"] = row.get("year") if row.get("year") is not None else ""
            row["terms_accepted_at"] = _iso_or_none(row.get("terms_accepted_at"))
            row["created_at"] = _iso_or_none(row.get("created_at"))

        return JsonResponse({"ok": True, "voters": rows})
    except Exception as e:
        if getattr(settings, "DEBUG", False):
            return JsonResponse({"ok": False, "error": str(e)}, status=500)
        return JsonResponse({"ok": False, "error": "Failed to load voters."}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def admin_voters_import_api(request):
    _ensure_auth_identity_tables()

    forbidden = _require_voters_access(request)
    if forbidden:
        return forbidden

    try:
        payload = json.loads((request.body or b"{}").decode("utf-8"))
    except Exception:
        payload = {}

    voters = payload.get("voters") or []
    if not isinstance(voters, list) or not voters:
        return JsonResponse({"ok": False, "error": "No voters supplied."}, status=400)
    row_start = _safe_int_or_none(payload.get("row_start")) or 2

    imported = 0
    failed = []
    try:
        with transaction.atomic():
            with connection.cursor() as cur:
                for index, voter in enumerate(voters, start=row_start):
                    if not isinstance(voter, dict):
                        failed.append({"row": index, "error": "Invalid row."})
                        continue
                    sid = transaction.savepoint()
                    try:
                        err = _upsert_voter_row(cur, voter)
                        if err:
                            transaction.savepoint_rollback(sid)
                            failed.append({"row": index, "id_number": voter.get("id_number") or voter.get("student_id"), "error": err})
                        else:
                            transaction.savepoint_commit(sid)
                            imported += 1
                    except Exception as row_error:
                        transaction.savepoint_rollback(sid)
                        logger.exception("Failed to import voter row %s", index)
                        failed.append({
                            "row": index,
                            "id_number": voter.get("id_number") or voter.get("student_id"),
                            "error": str(row_error) if getattr(settings, "DEBUG", False) else "Database error while saving this row.",
                        })

        return JsonResponse({"ok": True, "imported": imported, "failed": failed})
    except Exception as e:
        logger.exception("Failed to import voters.")
        if getattr(settings, "DEBUG", False):
            return JsonResponse({"ok": False, "error": str(e)}, status=500)
        return JsonResponse({"ok": False, "error": "Failed to import voters."}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def admin_voters_delete_api(request):
    _ensure_auth_identity_tables()

    forbidden = _require_voters_access(request)
    if forbidden:
        return forbidden

    try:
        payload = json.loads((request.body or b"{}").decode("utf-8"))
    except Exception:
        payload = {}

    ids = payload.get("ids") or []
    filters = payload.get("filters") or {}
    if ids is not None and not isinstance(ids, list):
        return JsonResponse({"ok": False, "error": "Invalid voter ids."}, status=400)
    if not isinstance(filters, dict):
        filters = {}

    id_values = [str(v or "").strip() for v in ids if str(v or "").strip()]
    params = []
    where = "WHERE COALESCE(u.role, '') ILIKE 'student'"

    if id_values:
        placeholders = ",".join(["%s"] * len(id_values))
        where += f" AND u.student_id::text IN ({placeholders})"
        params.extend(id_values)
    else:
        course = str(filters.get("course") or "").strip().upper()
        year = str(filters.get("year") or "").strip()
        section = str(filters.get("section") or "").strip()

        if course and course != "ALL":
            where += " AND UPPER(COALESCE(s.course, u.department, '')) = %s"
            params.append(course)
        if year:
            year_value = _safe_int_or_none(year)
            if year_value is None:
                return JsonResponse({"ok": False, "error": "Invalid year filter."}, status=400)
            where += " AND COALESCE(s.year, u.year_level) = %s"
            params.append(year_value)
        if section:
            where += " AND COALESCE(s.section, u.section, '') = %s"
            params.append(section)

    try:
        with transaction.atomic():
            with connection.cursor() as cur:
                cur.execute(
                    f"""
                    SELECT DISTINCT u.student_id::text
                    FROM users u
                    LEFT JOIN student s ON s.id_number::text = u.student_id::text
                    {where}
                    """,
                    params,
                )
                target_ids = [str(row[0]) for row in cur.fetchall() if row and row[0] is not None]

                if not target_ids:
                    return JsonResponse({"ok": True, "deleted": 0})

                placeholders = ",".join(["%s"] * len(target_ids))
                cur.execute(
                    f"DELETE FROM users WHERE COALESCE(role, '') ILIKE 'student' AND student_id::text IN ({placeholders})",
                    target_ids,
                )
                deleted_users = cur.rowcount
                cur.execute(
                    f"DELETE FROM student WHERE id_number::text IN ({placeholders})",
                    target_ids,
                )

        return JsonResponse({"ok": True, "deleted": int(deleted_users or 0)})
    except Exception as e:
        logger.exception("Failed to delete voters.")
        if getattr(settings, "DEBUG", False):
            return JsonResponse({"ok": False, "error": str(e)}, status=500)
        return JsonResponse({"ok": False, "error": "Failed to delete voters."}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def admin_voters_update_api(request):
    _ensure_auth_identity_tables()

    forbidden = _require_voters_access(request)
    if forbidden:
        return forbidden

    try:
        payload = json.loads((request.body or b"{}").decode("utf-8"))
    except Exception:
        payload = {}

    id_number = str(payload.get("id_number") or payload.get("student_id") or "").strip()
    if not id_number:
        return JsonResponse({"ok": False, "error": "Missing ID Number."}, status=400)

    year = _safe_int_or_none(payload.get("year") or payload.get("year_level"))
    section = str(payload.get("section") or "").strip()
    email = str(payload.get("email") or "").strip()
    phone = str(payload.get("phone_number") or payload.get("phone") or "").strip()

    missing = []
    if year is None:
        missing.append("Year")
    if not section:
        missing.append("Section")
    if not email:
        missing.append("Email")
    if not phone:
        missing.append("Phone Number")
    if missing:
        return JsonResponse({"ok": False, "error": f"Missing {', '.join(missing)}."}, status=400)

    try:
        with transaction.atomic():
            with connection.cursor() as cur:
                cur.execute(
                    """
                    UPDATE student
                    SET year = %s,
                        section = %s,
                        email = %s,
                        phone_number = %s
                    WHERE id_number::text = %s
                    """,
                    [year, section, email, phone, id_number],
                )

                cur.execute(
                    """
                    UPDATE users
                    SET year_level = %s,
                        section = %s,
                        phone = %s,
                        email = %s
                    WHERE student_id::text = %s
                      AND COALESCE(role, '') ILIKE 'student'
                    """,
                    [year, section, phone, email, id_number],
                )

        return JsonResponse({"ok": True})
    except Exception as e:
        logger.exception("Failed to update voter.")
        if getattr(settings, "DEBUG", False):
            return JsonResponse({"ok": False, "error": str(e)}, status=500)
        return JsonResponse({"ok": False, "error": "Failed to update voter."}, status=500)


@require_http_methods(["GET"])
def admin_results_api(request):
    forbidden = _require_admin(request)
    if forbidden:
        return forbidden

    _ensure_votes_tables()
    requested_election_id = _parse_election_id_from_request(request, {"election_id": request.GET.get("election_id")})
    election_where, election_params = _current_election_filter("c", requested_election_id)
    vote_filter, vote_params = _current_vote_filter("v", requested_election_id)
    vote_where = f"WHERE {vote_filter}"

    try:
        with connection.cursor() as cur:
            cur.execute(
                f"""
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
                    JOIN votes v ON v.id = vi.vote_id
                    {vote_where}
                    GROUP BY vi.candidate_id
                ) vv ON vv.cid = c.id
                WHERE {election_where}
                ORDER BY c.party_name, c.organization, c.position, c.last_name, c.first_name
                """
                ,
                vote_params + election_params,
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
            "election_id": requested_election_id or _active_election_id(),
        }
    )


@require_http_methods(["GET"])
def user_results_api(request):
    """Public results API for students - only returns data if results are published."""
    _ensure_election_scoped_tables()

    def published_dt(value):
        if not value:
            return None
        if timezone.is_naive(value):
            return timezone.make_aware(value, timezone.get_current_timezone())
        return value.astimezone(timezone.get_current_timezone())

    if str(request.GET.get("elections") or "").strip() == "1":
        now = timezone.now()
        try:
            with connection.cursor() as cur:
                cur.execute(
                    """
                    SELECT id, election_name, school_year, results_at, status
                    FROM vote_windows
                    ORDER BY id DESC
                    """
                )
                rows = cur.fetchall()
        except Exception:
            return JsonResponse({"ok": False, "error": "Failed to load elections."}, status=500)

        elections = []
        for eid, name, school_year, results_at, status in rows:
            result_dt = published_dt(results_at)
            if not result_dt or now < result_dt:
                continue
            elections.append(
                {
                    "id": int(eid),
                    "name": name or (f"ELECOM Election {school_year}" if school_year else f"Election #{eid}"),
                    "school_year": school_year or "",
                    "results_at": result_dt.isoformat(),
                    "status": status or "",
                }
            )
        return JsonResponse({"ok": True, "elections": elections})

    requested_election_id = _parse_election_id_from_request(
        request,
        {"election_id": request.GET.get("election_id")},
    )

    # Check if results should be available (results_at date has passed)
    try:
        with connection.cursor() as cur:
            if requested_election_id is not None:
                cur.execute(
                    "SELECT id, results_at FROM vote_windows WHERE id = %s LIMIT 1",
                    [requested_election_id],
                )
            else:
                cur.execute("SELECT id, results_at FROM vote_windows ORDER BY id DESC LIMIT 1")
            row = cur.fetchone()
        
        if not row or not row[1]:
            return JsonResponse(
                {"ok": True, "published": False, "message": "Results not yet scheduled."}
            )
        
        selected_election_id = int(row[0] or 0) or requested_election_id
        results_at = published_dt(row[1])

        now = timezone.now()
        if now < results_at:
            return JsonResponse(
                {
                    "ok": True, 
                    "published": False, 
                    "results_at": results_at.isoformat(),
                    "message": "Results will be available after the scheduled time."
                }
            )
    except Exception:
        selected_election_id = requested_election_id
        pass  # If we can't check, proceed to return results anyway

    _ensure_votes_tables()
    election_where, election_params = _current_election_filter("c", selected_election_id)
    vote_filter, vote_params = _current_vote_filter("v", selected_election_id)
    vote_where = f"WHERE {vote_filter}"

    # Return the same data structure as admin_results_api
    try:
        with connection.cursor() as cur:
            cur.execute(
                f"""
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
                    JOIN votes v ON v.id = vi.vote_id
                    {vote_where}
                    GROUP BY vi.candidate_id
                ) vv ON vv.cid = c.id
                WHERE {election_where}
                ORDER BY c.party_name, c.organization, c.position, c.last_name, c.first_name
                """
                ,
                vote_params + election_params,
            )
            cols = [c[0] for c in cur.description]
            candidates = [dict(zip(cols, r)) for r in cur.fetchall()]
    except Exception:
        return JsonResponse({"ok": False, "error": "Failed to load results."}, status=500)

    if not candidates:
        return JsonResponse(
            {
                "ok": True,
                "published": True,
                "election_id": selected_election_id or _active_election_id(),
                "org_totals": {},
                "position_totals": {},
                "grouped": [],
            }
        )

    usg_order = [
        "President", "Vice President", "General Secretary", "Associate Secretary",
        "Treasurer", "Auditor", "Public Information Officer", "P.I.O",
        "IT Representative", "BSIT Representative", "BTLED Representative", "BFPT Representative",
    ]
    org_order = [
        "President", "Vice President", "General Secretary", "Associate Secretary",
        "Treasurer", "Auditor", "Public Information Officer", "P.I.O",
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

                total_pos_votes = sum(int(x.get("votes") or 0) for x in arr_sorted) or 1
                cand_out = []
                for x in arr_sorted:
                    votes = int(x.get("votes") or 0)
                    pct = round((votes / total_pos_votes) * 100, 1) if total_pos_votes else 0.0
                    name = " ".join(
                        [p for p in [x.get("first_name"), x.get("middle_name"), x.get("last_name")] if p]
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
            "published": True,
            "election_id": selected_election_id or _active_election_id(),
            "org_totals": org_totals,
            "position_totals": position_totals,
            "grouped": grouped_out,
        }
    )


@require_http_methods(["GET"])
def results_analytics_api(request):
    """
    Aggregated election analytics (privacy-safe).
    Does not expose student identities or vote choices.
    """
    student_id = (request.session.get("student_id") or "").strip()
    if not student_id:
        return JsonResponse({"ok": False, "error": "Unauthorized."}, status=401)

    _ensure_votes_tables()
    _ensure_vote_blocks_table()
    _ensure_validator_tables()

    # Eligible voters: count from student table (fallback to users).
    eligible_voters = 0
    voted_students = 0
    turnout_pct = 0.0

    program_counts = {"BSIT": 0, "BTLED": 0, "BFPT": 0}
    most_voted_position = "Not enough data yet"
    least_voted_position = "Not enough data yet"
    skipped_positions = 0
    skipped_positions_pct = 0.0
    peak_window_label = "Not enough data yet"
    peak_window_votes = 0
    peak_window_note = ""
    peak_has_enough_data = False
    peak_trend: list[dict] = []

    ledger = {
        "total_vote_blocks": 0,
        "ledger_status": "Unknown",
        "active_validator_nodes": 0,
        "latest_block_status": "pending",
        "validator_consensus": "-",
    }

    try:
        with connection.cursor() as cur:
            # Eligible voters (prefer student table).
            try:
                cur.execute("SELECT COUNT(*) FROM student")
                row = cur.fetchone()
                eligible_voters = int(row[0] or 0) if row else 0
            except Exception:
                eligible_voters = 0
            if eligible_voters <= 0:
                try:
                    cur.execute("SELECT COUNT(*) FROM users WHERE COALESCE(role,'') ILIKE 'student'")
                    row = cur.fetchone()
                    eligible_voters = int(row[0] or 0) if row else 0
                except Exception:
                    eligible_voters = 0

            # Total students voted.
            cur.execute("SELECT COUNT(DISTINCT student_id) FROM votes")
            row = cur.fetchone()
            voted_students = int(row[0] or 0) if row else 0

            if eligible_voters > 0:
                turnout_pct = round((voted_students / eligible_voters) * 100.0, 1)

            # Participation by program (from users.department).
            cur.execute(
                """
                SELECT program_code, COUNT(*) AS cnt
                FROM (
                    SELECT DISTINCT v.student_id,
                        CASE
                            WHEN UPPER(COALESCE(u.department,'')) LIKE '%BSIT%' OR UPPER(COALESCE(u.department,'')) LIKE '%INFORMATION TECHNOLOGY%' THEN 'BSIT'
                            WHEN UPPER(COALESCE(u.department,'')) LIKE '%BTLED%' OR UPPER(COALESCE(u.department,'')) LIKE '%LIVELIHOOD%' THEN 'BTLED'
                            WHEN UPPER(COALESCE(u.department,'')) LIKE '%BFPT%' OR UPPER(COALESCE(u.department,'')) LIKE '%FOOD PROCESS%' THEN 'BFPT'
                            ELSE 'OTHER'
                        END AS program_code
                    FROM votes v
                    LEFT JOIN users u
                      ON u.student_id::text = v.student_id::text
                ) x
                GROUP BY program_code
                """
            )
            for code, cnt in (cur.fetchall() or []):
                c = str(code or "").upper()
                if c in program_counts:
                    program_counts[c] = int(cnt or 0)

            # Vote completion: normalize vote_items.position because stored value is often "ORG::Position".
            cur.execute(
                """
                WITH pos_catalog AS (
                    SELECT DISTINCT TRIM(position) AS pos
                    FROM candidates_registration
                    WHERE COALESCE(TRIM(position), '') <> ''
                )
                SELECT COUNT(*) FROM pos_catalog
                """
            )
            row = cur.fetchone()
            total_positions = int(row[0] or 0) if row else 0

            # Most/least voted positions (include zeros for positions with no votes).
            if total_positions > 0:
                cur.execute(
                    """
                    WITH pos AS (
                      SELECT DISTINCT TRIM(position) AS position
                      FROM candidates_registration
                      WHERE COALESCE(TRIM(position), '') <> ''
                    ),
                    counts AS (
                      SELECT
                        CASE
                          WHEN POSITION('::' IN COALESCE(position,'')) > 0
                            THEN SPLIT_PART(position, '::', 2)
                          ELSE COALESCE(position, '')
                        END AS position,
                        COUNT(*) AS cnt
                      FROM vote_items
                      GROUP BY 1
                    )
                    SELECT p.position, COALESCE(c.cnt, 0) AS cnt
                    FROM pos p
                    LEFT JOIN counts c ON c.position = p.position
                    ORDER BY p.position ASC
                    """
                )
                pos_rows = [(str(r[0] or ""), int(r[1] or 0)) for r in (cur.fetchall() or [])]
                if pos_rows:
                    max_cnt = max(cnt for _p, cnt in pos_rows)
                    min_cnt = min(cnt for _p, cnt in pos_rows)
                    max_positions = [p for p, cnt in pos_rows if cnt == max_cnt]
                    min_positions = [p for p, cnt in pos_rows if cnt == min_cnt]

                    # Most voted label
                    if max_cnt <= 0:
                        most_voted_position = "Not enough data yet"
                    elif len(max_positions) == 1:
                        most_voted_position = max_positions[0]
                    else:
                        most_voted_position = "Multiple positions"

                    # Least voted label
                    if min_cnt <= 0 and len(min_positions) == len(pos_rows):
                        least_voted_position = "Not enough data yet"
                    elif len(min_positions) > 1:
                        least_voted_position = "Multiple positions"
                    else:
                        least_voted_position = min_positions[0]

                # Skipped positions estimate using distinct positions per vote (avoids representative multi-select inflation).
                cur.execute("SELECT COUNT(*) FROM votes")
                row = cur.fetchone()
                total_votes = int(row[0] or 0) if row else 0

                if total_votes > 0:
                    cur.execute("SELECT COUNT(DISTINCT (vote_id, position)) FROM vote_items")
                    row = cur.fetchone()
                    distinct_vote_positions = int(row[0] or 0) if row else 0
                    expected = total_votes * total_positions
                    skipped_positions = max(expected - distinct_vote_positions, 0)
                    skipped_positions_pct = round((skipped_positions / expected) * 100.0, 1) if expected > 0 else 0.0

            # Peak voting time (hour bucket) using actual vote submission timestamp.
            # Source: votes.created_at, converted to Asia/Manila before hourly grouping.
            cur.execute("SELECT COUNT(*) FROM votes")
            row = cur.fetchone()
            total_submitted_votes = int(row[0] or 0) if row else 0

            if total_submitted_votes >= 3:
                peak_has_enough_data = True
                cur.execute(
                    """
                    WITH hourly AS (
                        SELECT date_trunc('hour', timezone('Asia/Manila', created_at)) AS bucket,
                               COUNT(*) AS cnt
                        FROM votes
                        GROUP BY 1
                    )
                    SELECT bucket, cnt
                    FROM hourly
                    ORDER BY cnt DESC, bucket ASC
                    """
                )
                bucket_rows = cur.fetchall() or []
                if bucket_rows:
                    top_cnt = int(bucket_rows[0][1] or 0)
                    top_rows = [r for r in bucket_rows if int(r[1] or 0) == top_cnt]
                    peak_window_votes = top_cnt

                    earliest_bucket = top_rows[0][0]
                    start = earliest_bucket
                    end = earliest_bucket + timedelta(hours=1)
                    start_s = start.strftime("%I:%M %p").lstrip("0")
                    end_s = end.strftime("%I:%M %p").lstrip("0")

                    if len(top_rows) > 1:
                        peak_window_label = "Multiple peak times"
                        peak_window_note = f"Earliest peak: {start_s} - {end_s}"
                    else:
                        peak_window_label = f"{start_s} - {end_s}"

                    peak_buckets = {r[0] for r in top_rows}
                    ordered_rows = sorted(
                        [(r[0], int(r[1] or 0)) for r in bucket_rows],
                        key=lambda x: x[0],
                    )
                    peak_trend = []
                    for bucket_dt, cnt in ordered_rows:
                        slot_start = bucket_dt.strftime("%I:%M %p").lstrip("0")
                        slot_end = (bucket_dt + timedelta(hours=1)).strftime("%I:%M %p").lstrip("0")
                        peak_trend.append(
                            {
                                "bucket_start": bucket_dt.isoformat(),
                                "window_label": f"{slot_start} - {slot_end}",
                                "x_label": slot_start,
                                "votes": cnt,
                                "is_peak": bucket_dt in peak_buckets,
                            }
                        )
            else:
                peak_window_label = "Not enough data yet"
                peak_window_votes = 0
                peak_window_note = "At least 3 submitted votes are needed."
                peak_trend = []
    except Exception:
        pass

    # Ledger/security summary from vote_blocks + validations.
    try:
        with connection.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM vote_blocks")
            row = cur.fetchone()
            total_blocks = int(row[0] or 0) if row else 0
            ledger["total_vote_blocks"] = total_blocks

            cur.execute("SELECT COUNT(*) FROM validator_nodes WHERE is_active = TRUE")
            row = cur.fetchone()
            active_nodes = int(row[0] or 0) if row else 0
            ledger["active_validator_nodes"] = active_nodes

            latest_block_status = "pending"
            latest_block_id = 0
            cur.execute("SELECT id, block_status FROM vote_blocks ORDER BY id DESC LIMIT 1")
            row = cur.fetchone()
            if row:
                latest_block_id = int(row[0] or 0)
                latest_block_status = str(row[1] or "pending").lower()
            ledger["latest_block_status"] = latest_block_status

            # consensus: latest approvals among active nodes
            if latest_block_id > 0 and active_nodes > 0:
                cur.execute(
                    """
                    SELECT SUM(CASE WHEN v.validation_status = 'approved' THEN 1 ELSE 0 END) AS approved_count,
                           COUNT(*) AS total_count
                    FROM (
                        SELECT DISTINCT ON (bv.validator_node_id)
                            bv.validator_node_id, bv.validation_status, bv.validated_at
                        FROM block_validations bv
                        JOIN validator_nodes vn
                          ON vn.id = bv.validator_node_id
                         AND vn.is_active = TRUE
                        WHERE bv.vote_block_id = %s
                        ORDER BY bv.validator_node_id, bv.validated_at DESC
                    ) v
                    """,
                    [latest_block_id],
                )
                row = cur.fetchone()
                approved = int(row[0] or 0) if row else 0
                total = int(row[1] or 0) if row else 0
                ledger["validator_consensus"] = f"{approved}/{total if total > 0 else active_nodes} nodes approved"

        # Use existing verifier to set status label
        try:
            # Call internal verify logic by reusing the HTTP function isn't convenient here;
            # compute a simplified label: if any missing block / hash mismatch -> Critical Warning.
            ledger["ledger_status"] = "Valid"
        except Exception:
            ledger["ledger_status"] = "Unknown"
    except Exception:
        pass

    # Better ledger_status: use verify endpoint logic quickly (hash chain + missing ids)
    try:
        with connection.cursor() as cur:
            cur.execute(
                """
                SELECT id, election_id, anonymous_voter_hash, vote_data_hash,
                       previous_hash, current_hash, submitted_at
                FROM vote_blocks
                ORDER BY id ASC
                """
            )
            cols = [c[0] for c in cur.description]
            blocks = [dict(zip(cols, r)) for r in (cur.fetchall() or [])]
        issues = 0
        critical = False
        if blocks:
            expected_id = int(blocks[0].get("id") or 1)
            for b in blocks:
                bid = int(b.get("id") or 0)
                if bid != expected_id:
                    critical = True
                    issues += 1
                    expected_id = bid
                expected_id += 1
            prev_current = ""
            for b in blocks:
                bid = int(b.get("id") or 0)
                prev_hash = str(b.get("previous_hash") or "")
                cur_hash = str(b.get("current_hash") or "")
                if prev_hash != prev_current:
                    critical = True
                    issues += 1
                expected_hash = _compute_expected_block_hash(
                    election_id=int(b.get("election_id") or 0),
                    anonymous_voter_hash=str(b.get("anonymous_voter_hash") or ""),
                    vote_data_hash=str(b.get("vote_data_hash") or ""),
                    previous_hash=prev_hash,
                    submitted_at=b.get("submitted_at"),
                )
                if expected_hash != cur_hash:
                    critical = True
                    issues += 1
                prev_current = cur_hash
        if critical:
            ledger["ledger_status"] = "Critical Warning"
        elif issues > 0:
            ledger["ledger_status"] = "Warning"
        else:
            ledger["ledger_status"] = "Valid"
    except Exception:
        pass

    return JsonResponse(
        {
            "ok": True,
            "turnout": {
                "eligible_voters": eligible_voters,
                "voted_students": voted_students,
                "turnout_percentage": turnout_pct,
            },
            "participation_by_program": program_counts,
            "vote_completion": {
                "most_voted_position": most_voted_position,
                "least_voted_position": least_voted_position,
                "skipped_positions": skipped_positions,
                "skipped_positions_percentage": skipped_positions_pct,
            },
            "peak_voting_time": {
                "label": peak_window_label,
                "votes_submitted": peak_window_votes,
                "note": peak_window_note,
                "has_enough_data": peak_has_enough_data,
                "trend": peak_trend,
            },
            "ledger_security": ledger,
        }
    )


@csrf_exempt
@require_http_methods(["GET", "POST"])
def admin_election_window_api(request):
    forbidden = _require_admin(request)
    if forbidden:
        return forbidden

    if request.method == "GET":
        try:
            _ensure_election_scoped_tables()
            with connection.cursor() as cur:
                cur.execute(
                    "SELECT id, start_at, end_at, results_at, note FROM vote_windows ORDER BY id DESC LIMIT 1"
                )
                row = cur.fetchone()
            if not row:
                return JsonResponse({"ok": True, "window": None})
            election_id, start_at, end_at, results_at, note = row
            return JsonResponse(
                {
                    "ok": True,
                    "window": {
                        "id": int(election_id) if election_id is not None else None,
                        "start_at": _iso_or_none(start_at),
                        "end_at": _iso_or_none(end_at),
                        "results_at": _iso_or_none(results_at),
                        "note": note or "",
                        "start_at_local": _election_datetime_local_for_admin_form(start_at),
                        "end_at_local": _election_datetime_local_for_admin_form(end_at),
                        "results_at_local": _election_datetime_local_for_admin_form(results_at),
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

    start_db = _election_naive_utc_from_admin_form(start_dt)
    end_db = _election_naive_utc_from_admin_form(end_dt)
    results_db = _election_naive_utc_from_admin_form(results_dt) if results_dt else None

    if not start_db or not end_db:
        return JsonResponse({"ok": False, "error": "Invalid date/time values."}, status=400)

    # Compare using aware instants (same wall times the admin chose).
    manila_tz = ZoneInfo("Asia/Manila")

    start_cmp = timezone.make_aware(start_db, manila_tz)
    end_cmp = timezone.make_aware(end_db, manila_tz)
    results_cmp = timezone.make_aware(results_db, manila_tz) if results_db else None


    if end_cmp <= start_cmp:
        return JsonResponse({"ok": False, "error": "End must be after Start."}, status=400)

    if results_cmp and results_cmp < end_cmp:
        return JsonResponse({"ok": False, "error": "Results date/time must be on/after End."}, status=400)

    try:
        _ensure_election_scoped_tables()
        with connection.cursor() as cur:
            cur.execute("SELECT id, end_at FROM vote_windows ORDER BY id DESC LIMIT 1")
            last = cur.fetchone()
            if last and last[0] is not None:
                last_id = int(last[0])
                last_end = last[1]
                create_new = _post_bool(payload, "create_new", False)
                if last_end:
                    try:
                        create_new = create_new or (timezone.now().replace(tzinfo=None) > last_end and start_db > last_end)
                    except Exception:
                        pass

                if create_new:
                    cur.execute(
                        "UPDATE candidates_registration SET election_id = %s WHERE election_id IS NULL",
                        [last_id],
                    )
                    cur.execute(
                        """
                        INSERT INTO vote_windows (start_at, end_at, results_at, note)
                        VALUES (%s, %s, %s, %s)
                        RETURNING id
                        """,
                        [start_db, end_db, results_db, note or None],
                    )
                    new_row = cur.fetchone()
                    new_id = int(new_row[0]) if new_row and new_row[0] is not None else None
                    return JsonResponse({"ok": True, "election_id": new_id, "created_new": True})
                else:
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
                        [start_db, end_db, results_db, note or None, last_id],
                    )
            else:
                cur.execute(
                    """
                    INSERT INTO vote_windows (start_at, end_at, results_at, note)
                    VALUES (%s, %s, %s, %s)
                    RETURNING id
                    """,
                    [start_db, end_db, results_db, note or None],
                )
                new_row = cur.fetchone()
                new_id = int(new_row[0]) if new_row and new_row[0] is not None else None
                return JsonResponse({"ok": True, "election_id": new_id, "created_new": True})
        return JsonResponse({"ok": True, "created_new": False})
    except Exception as e:
        if getattr(settings, "DEBUG", False):
            return JsonResponse({"ok": False, "error": str(e)}, status=500)
        return JsonResponse({"ok": False, "error": "Failed to save election window."}, status=500)


@csrf_exempt
@require_http_methods(["GET", "POST"])
def admin_elections_api(request):
    forbidden = _require_admin(request)
    if forbidden:
        return forbidden

    _ensure_election_scoped_tables()

    if request.method == "GET":
        try:
            with connection.cursor() as cur:
                cur.execute("SELECT COALESCE(MAX(id), 0) FROM vote_windows")
                max_row = cur.fetchone()
                max_id = int(max_row[0] or 0) if max_row else 0
                cur.execute(
                    """
                    SELECT w.id,
                           w.election_name,
                           w.school_year,
                           w.start_at,
                           w.end_at,
                           w.results_at,
                           w.note,
                           w.status,
                           (
                               SELECT COUNT(*)
                               FROM candidates_registration cc
                               WHERE cc.election_id = w.id
                                  OR (cc.election_id IS NULL AND w.id = %s)
                           ) AS candidate_count,
                           (
                               SELECT COUNT(*)
                               FROM votes vv
                               WHERE vv.election_id = w.id
                                  OR (vv.election_id IS NULL AND w.id <> %s)
                           ) AS vote_count,
                           (
                               SELECT COUNT(*)
                               FROM users uu
                               WHERE COALESCE(uu.role, '') ILIKE 'student'
                           ) AS voter_count
                    FROM vote_windows w
                    ORDER BY w.id DESC
                    """,
                    [max_id, max_id],
                )
                cols = [c[0] for c in cur.description]
                rows = [dict(zip(cols, r)) for r in cur.fetchall()]
        except Exception as e:
            if getattr(settings, "DEBUG", False):
                return JsonResponse({"ok": False, "error": str(e)}, status=500)
            return JsonResponse({"ok": False, "error": "Failed to load elections."}, status=500)

        elections = []
        for row in rows:
            eid = int(row.get("id") or 0)
            name = str(row.get("election_name") or "").strip()
            if not name:
                sy = str(row.get("school_year") or "").strip()
                name = f"ELECOM Election {sy}" if sy else f"ELECOM Election #{eid}"
            status = _election_status_from_window(
                election_id=eid,
                max_id=max_id,
                start_at=row.get("start_at"),
                end_at=row.get("end_at"),
                db_status=row.get("status"),
            )
            elections.append(
                {
                    "id": eid,
                    "name": name,
                    "school_year": row.get("school_year") or "",
                    "start_at": _iso_or_none(row.get("start_at")),
                    "end_at": _iso_or_none(row.get("end_at")),
                    "results_at": _iso_or_none(row.get("results_at")),
                    "start_at_local": _election_datetime_local_for_admin_form(row.get("start_at")),
                    "end_at_local": _election_datetime_local_for_admin_form(row.get("end_at")),
                    "results_at_local": _election_datetime_local_for_admin_form(row.get("results_at")),
                    "note": row.get("note") or "",
                    "status": status,
                    "is_active": eid == max_id,
                    "candidate_count": int(row.get("candidate_count") or 0),
                    "vote_count": int(row.get("vote_count") or 0),
                    "voter_count": int(row.get("voter_count") or 0),
                }
            )
        return JsonResponse({"ok": True, "active_election_id": max_id or None, "elections": elections})

    try:
        payload = json.loads((request.body or b"{}").decode("utf-8"))
    except Exception:
        payload = {}

    name = str(payload.get("name") or payload.get("election_name") or "").strip()
    school_year = str(payload.get("school_year") or "").strip()
    start_at = str(payload.get("start_at") or "").strip()
    end_at = str(payload.get("end_at") or "").strip()
    results_at = str(payload.get("results_at") or "").strip() or None
    note = str(payload.get("note") or "").strip()
    admin_password = str(payload.get("admin_password") or "").strip()
    action = str(payload.get("action") or "create").strip().lower()
    election_id_raw = payload.get("election_id")
    election_id = None
    if election_id_raw not in (None, ""):
        try:
            election_id = int(election_id_raw)
        except (TypeError, ValueError):
            return JsonResponse({"ok": False, "error": "Invalid election ID."}, status=400)

    if action not in {"create", "update"}:
        return JsonResponse({"ok": False, "error": "Invalid election action."}, status=400)
    if action == "create" and not name:
        return JsonResponse({"ok": False, "error": "Election name is required."}, status=400)
    if action == "update" and not election_id:
        return JsonResponse({"ok": False, "error": "Election ID is required."}, status=400)
    if not start_at or not end_at:
        return JsonResponse({"ok": False, "error": "Start and End date/time are required."}, status=400)
    if not admin_password:
        return JsonResponse({"ok": False, "error": "Admin password is required."}, status=400)

    student_id = str(request.session.get("student_id") or "").strip()
    if not student_id:
        return JsonResponse({"ok": False, "error": "Unauthorized."}, status=401)
    try:
        with connection.cursor() as cur:
            cur.execute(
                """
                SELECT password_hash
                FROM users
                WHERE (student_id::text = %s OR id::text = %s)
                  AND COALESCE(role, '') ILIKE 'admin'
                ORDER BY CASE WHEN student_id::text = %s THEN 0 ELSE 1 END, id DESC
                LIMIT 1
                """,
                [student_id, student_id, student_id],
            )
            row = cur.fetchone()
        if not row or not _verify_password(str(row[0] or ""), admin_password):
            return JsonResponse({"ok": False, "error": "Incorrect admin password."}, status=401)
    except Exception as e:
        if getattr(settings, "DEBUG", False):
            return JsonResponse({"ok": False, "error": str(e)}, status=500)
        return JsonResponse({"ok": False, "error": "Failed to verify admin password."}, status=500)

    from django.utils.dateparse import parse_datetime

    start_dt = parse_datetime(start_at)
    end_dt = parse_datetime(end_at)
    results_dt = parse_datetime(results_at) if results_at else None
    start_db = _election_naive_utc_from_admin_form(start_dt) if start_dt else None
    end_db = _election_naive_utc_from_admin_form(end_dt) if end_dt else None
    results_db = _election_naive_utc_from_admin_form(results_dt) if results_dt else None
    if not start_db or not end_db:
        return JsonResponse({"ok": False, "error": "Invalid date/time values."}, status=400)
    if end_db <= start_db:
        return JsonResponse({"ok": False, "error": "End must be after Start."}, status=400)
    if results_db and results_db < end_db:
        return JsonResponse({"ok": False, "error": "Results date/time must be on/after End."}, status=400)

    try:
        with transaction.atomic():
            with connection.cursor() as cur:
                if action == "update":
                    cur.execute("SELECT id FROM vote_windows WHERE id = %s", [election_id])
                    if not cur.fetchone():
                        return JsonResponse({"ok": False, "error": "Election not found."}, status=404)
                    cur.execute(
                        """
                        UPDATE vote_windows
                        SET start_at = %s,
                            end_at = %s,
                            results_at = %s,
                            note = COALESCE(NULLIF(%s, ''), note)
                        WHERE id = %s
                        """,
                        [start_db, end_db, results_db, note, election_id],
                    )
                    return JsonResponse({"ok": True, "election_id": election_id, "updated": True})

                cur.execute("SELECT COALESCE(MAX(id), 0) FROM vote_windows")
                max_row = cur.fetchone()
                old_active = int(max_row[0] or 0) if max_row else 0
                if old_active:
                    cur.execute(
                        "UPDATE candidates_registration SET election_id = %s WHERE election_id IS NULL",
                        [old_active],
                    )
                    cur.execute(
                        "UPDATE vote_windows SET status = 'archived' WHERE id = %s",
                        [old_active],
                    )
                cur.execute(
                    """
                    INSERT INTO vote_windows (
                        election_name,
                        school_year,
                        start_at,
                        end_at,
                        results_at,
                        note,
                        status
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, 'active')
                    RETURNING id
                    """,
                    [name, school_year or None, start_db, end_db, results_db, note or None],
                )
                new_row = cur.fetchone()
                new_id = int(new_row[0]) if new_row and new_row[0] is not None else None
        return JsonResponse({"ok": True, "election_id": new_id})
    except Exception as e:
        if getattr(settings, "DEBUG", False):
            return JsonResponse({"ok": False, "error": str(e)}, status=500)
        message = "Failed to update election." if action == "update" else "Failed to create election."
        return JsonResponse({"ok": False, "error": message}, status=500)


@require_http_methods(["GET"])
def admin_reports_summary_api(request):
    forbidden = _require_admin(request)
    if forbidden:
        return forbidden

    _ensure_votes_tables()
    _ensure_election_scoped_tables()
    election_scope = (request.GET.get("scope") or "").strip().lower()
    election_id_raw = (request.GET.get("election_id") or "").strip()
    all_elections = election_scope == "all" or election_id_raw.lower() == "all"
    requested_election_id = None if all_elections else _parse_election_id_from_request(
        request,
        {"election_id": request.GET.get("election_id")},
    )
    if all_elections:
        vote_filter, vote_filter_params = "1=1", []
    else:
        vote_filter, vote_filter_params = _current_vote_filter("v", requested_election_id)

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
    where_votes += f" AND {vote_filter}"
    params.extend(vote_filter_params)
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
    try:
        with connection.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM users WHERE COALESCE(role, '') ILIKE 'student'")
            total_voters = int(cur.fetchone()[0] or 0)
    except Exception:
        total_voters = 0

    # candidates + votes per candidate
    candidates = []
    try:
        if all_elections:
            election_where, election_params = "1=1", []
            vote_item_filter, vote_params = "1=1", []
        else:
            election_where, election_params = _current_election_filter("c", requested_election_id)
            vote_item_filter, vote_params = _current_vote_filter("v", requested_election_id)
        vote_where_parts = [vote_item_filter]
        if start_dt:
            vote_where_parts.append("v.created_at >= %s")
            vote_params.append(start_dt)
        if end_dt_exclusive:
            vote_where_parts.append("v.created_at < %s")
            vote_params.append(end_dt_exclusive)
        vote_where = "WHERE " + " AND ".join(vote_where_parts)
        with connection.cursor() as cur:
            cur.execute(
                f"""
                SELECT c.id, c.student_id, c.first_name, c.middle_name, c.last_name,
                       c.organization, c.position,
                       COALESCE(vv.cnt, 0) AS votes
                FROM candidates_registration c
                LEFT JOIN (
                  SELECT vi.candidate_id AS cid, COUNT(*) AS cnt
                  FROM vote_items vi
                  JOIN votes v ON v.id = vi.vote_id
                  {vote_where}
                  GROUP BY vi.candidate_id
                ) vv ON vv.cid = c.id
                WHERE {election_where}
                ORDER BY c.organization, c.position, c.last_name, c.first_name
                """
                ,
                vote_params + election_params,
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
            "scope": "all" if all_elections else "election",
            "election_id": None if all_elections else (requested_election_id or _active_election_id()),
            "totals": {
                "total_votes": total_votes,
                "distinct_voters": distinct_voters,
                "total_candidates": len(candidates),
                "total_voters": total_voters,
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

    _ensure_votes_tables()
    _ensure_user_notifications_table()

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
        _ensure_votes_tables()
        _ensure_user_notifications_table()
        with connection.cursor() as cur:
            # Check initial counts
            cur.execute("SELECT COUNT(*) FROM vote_items")
            items_before = cur.fetchone()[0] or 0
            cur.execute("SELECT COUNT(*) FROM votes")
            votes_before = cur.fetchone()[0] or 0
            cur.execute("SELECT COUNT(*) FROM user_notifications")
            notifications_before = cur.fetchone()[0] or 0
            
            # Delete from child table first (vote_items has FK to votes)
            cur.execute("DELETE FROM vote_items")
            items_deleted = cur.rowcount
            
            # Then delete from parent table
            cur.execute("DELETE FROM votes")
            votes_deleted = cur.rowcount

            # Clear vote-related user notifications with the vote reset.
            cur.execute("DELETE FROM user_notifications")
            notifications_deleted = cur.rowcount
            
            # Optional: delete from legacy table
            try:
                cur.execute("DELETE FROM vote_results")
            except Exception:
                pass
            
            # Verify counts after deletion
            cur.execute("SELECT COUNT(*) FROM vote_items")
            items_after = cur.fetchone()[0] or 0
            cur.execute("SELECT COUNT(*) FROM votes")
            votes_after = cur.fetchone()[0] or 0
            cur.execute("SELECT COUNT(*) FROM user_notifications")
            notifications_after = cur.fetchone()[0] or 0
        
        if items_after > 0 or votes_after > 0 or notifications_after > 0:
            return JsonResponse({
                "ok": False, 
                "error": f"Failed to delete all reset records. Remaining: {votes_after} votes, {items_after} items, {notifications_after} notifications"
            }, status=500)
        
        return JsonResponse({
            "ok": True, 
            "deleted": {
                "votes": votes_before,
                "vote_items": items_before,
                "notifications": notifications_before
            }
        })
    except Exception as e:
        error_msg = str(e)
        if getattr(settings, "DEBUG", False):
            return JsonResponse({"ok": False, "error": error_msg}, status=500)
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


def _get_request_ip(request) -> str:
    return (
        request.META.get("HTTP_X_FORWARDED_FOR")
        or request.META.get("REMOTE_ADDR")
        or "127.0.0.1"
    ).split(",")[0].strip()


def _clean_network_ip(value: str | None) -> str:
    raw = str(value or "").strip()
    if not raw:
        return ""
    if "," in raw:
        raw = raw.split(",", 1)[0].strip()
    try:
        if "/" in raw:
            return str(ipaddress.ip_interface(raw).ip)
        return str(ipaddress.ip_address(raw))
    except Exception:
        return ""


_NETWORK_PUBLIC_IP_CACHE = {"ip": "", "expires_at": 0.0}


def _is_private_network_ip(value: str | None) -> bool:
    cleaned = _clean_network_ip(value)
    if not cleaned:
        return False
    try:
        addr = ipaddress.ip_address(cleaned)
        return addr.is_private or addr.is_loopback or addr.is_link_local
    except Exception:
        return False


def _get_server_public_ip() -> str:
    now = time.time()
    cached_ip = _NETWORK_PUBLIC_IP_CACHE.get("ip") or ""
    cached_expires = float(_NETWORK_PUBLIC_IP_CACHE.get("expires_at") or 0)
    if cached_ip and cached_expires > now:
        return cached_ip

    for url in ("https://api.ipify.org", "https://ifconfig.me/ip"):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "ELECOM-Network-Check/1.0"})
            with urllib.request.urlopen(req, timeout=1.5) as res:
                public_ip = _clean_network_ip(res.read(64).decode("utf-8", errors="ignore"))
            if public_ip:
                _NETWORK_PUBLIC_IP_CACHE["ip"] = public_ip
                _NETWORK_PUBLIC_IP_CACHE["expires_at"] = now + 60
                return public_ip
        except Exception:
            continue

    _NETWORK_PUBLIC_IP_CACHE["ip"] = ""
    _NETWORK_PUBLIC_IP_CACHE["expires_at"] = now + 10
    return ""


def _get_client_network_ip(request, payload: dict | None = None) -> tuple[str, str]:
    """
    Prefer the device LAN IP sent by the mobile client. The server request IP is
    only a fallback because online deployments usually see the public NAT IP.
    """
    payload = payload or {}
    candidates = [
        payload.get("device_ip"),
        payload.get("local_ip"),
        payload.get("network_ip"),
        payload.get("ip_address"),
        request.GET.get("device_ip"),
        request.GET.get("local_ip"),
        request.GET.get("network_ip"),
        request.GET.get("ip_address"),
        request.META.get("HTTP_X_DEVICE_LOCAL_IP"),
        request.META.get("HTTP_X_CLIENT_LOCAL_IP"),
    ]
    for candidate in candidates:
        cleaned = _clean_network_ip(candidate)
        if cleaned:
            return cleaned, "device"

    return _clean_network_ip(_get_request_ip(request)) or "127.0.0.1", "request"


def _network_check_ips(request, payload: dict | None = None) -> list[tuple[str, str]]:
    primary_ip, primary_source = _get_client_network_ip(request, payload)
    candidates = [(primary_ip, primary_source)]

    request_ip = _clean_network_ip(_get_request_ip(request)) or ""
    if request_ip and request_ip != primary_ip:
        candidates.append((request_ip, "request"))

    if _is_private_network_ip(primary_ip) or _is_private_network_ip(request_ip):
        public_ip = _get_server_public_ip()
        if public_ip and all(public_ip != ip for ip, _ in candidates):
            candidates.append((public_ip, "server_public"))

    return [(ip, source) for ip, source in candidates if ip]


def _authorized_network_matches(client_ip: str, rows: list[tuple]) -> bool:
    try:
        client_addr = ipaddress.ip_address(client_ip)
    except Exception:
        return False

    client_text = str(client_addr)
    for network_ip, ip_prefix in rows:
        network_text = str(network_ip or "").strip()
        prefix_text = str(ip_prefix or "").strip().rstrip(".")

        try:
            if "/" in network_text:
                if client_addr in ipaddress.ip_interface(network_text).network:
                    return True
            elif network_text and client_addr == ipaddress.ip_address(network_text):
                return True
        except Exception:
            pass

        if isinstance(client_addr, ipaddress.IPv4Address) and prefix_text:
            if client_text == prefix_text or client_text.startswith(prefix_text + "."):
                return True

    return False


def _network_authorization_result(request, payload: dict | None, rows: list[tuple]) -> dict:
    checked = _network_check_ips(request, payload)
    for ip, source in checked:
        if _authorized_network_matches(ip, rows):
            return {
                "allowed": True,
                "ip": ip,
                "source": source,
                "checked": checked,
            }
    fallback_ip, fallback_source = checked[0] if checked else ("127.0.0.1", "request")
    return {
        "allowed": False,
        "ip": fallback_ip,
        "source": fallback_source,
        "checked": checked,
    }


def _network_checked_ips_message(checked: list[tuple[str, str]]) -> str:
    parts = [f"{source} IP {ip}" for ip, source in checked]
    return ", ".join(parts) if parts else "request IP 127.0.0.1"


def _network_log_iso_or_none(dt):
    if not dt:
        return None
    try:
        if timezone.is_naive(dt):
            dt = dt.replace(tzinfo=dt_timezone.utc)
        return dt.astimezone(ZoneInfo("Asia/Manila")).isoformat()
    except Exception:
        try:
            return dt.isoformat()
        except Exception:
            return None


def _ensure_network_authorization_tables(cur) -> None:
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS authorized_networks (
            id SERIAL PRIMARY KEY,
            network_ip INET NOT NULL,
            ip_prefix VARCHAR(100),
            ssid VARCHAR(100),
            status VARCHAR(20) DEFAULT 'Active',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS network_access_attempts (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NULL,
            student_id VARCHAR(50),
            ip_address INET NOT NULL,
            ssid VARCHAR(100),
            status VARCHAR(20),
            message TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    cur.execute(
        """
        CREATE INDEX IF NOT EXISTS authorized_networks_status_idx
        ON authorized_networks (status)
        """
    )
    cur.execute(
        """
        CREATE INDEX IF NOT EXISTS network_access_attempts_created_at_idx
        ON network_access_attempts (created_at DESC)
        """
    )


@csrf_exempt
@require_http_methods(["GET", "POST", "DELETE"])
def admin_network_settings_api(request):
    """Get or update network authorization settings."""
    forbidden = _require_admin(request)
    if forbidden:
        return forbidden

    if request.method == "GET":
        try:
            request_ip = _clean_network_ip(_get_request_ip(request)) or "127.0.0.1"
            with connection.cursor() as cur:
                _ensure_network_authorization_tables(cur)
                cur.execute(
                    """
                    SELECT id, network_ip::text, ip_prefix, ssid, status, created_at, updated_at
                    FROM authorized_networks
                    ORDER BY updated_at DESC, id DESC
                    """
                )
                networks = [
                    {
                        "id": row[0],
                        "network_ip": row[1],
                        "ip_prefix": row[2],
                        "ssid": row[3],
                        "status": row[4],
                        "created_at": row[5],
                        "updated_at": row[6],
                    }
                    for row in cur.fetchall()
                ]
                cur.execute(
                    """
                    SELECT network_ip::text, ip_prefix, ssid, status
                    FROM authorized_networks
                    ORDER BY updated_at DESC, id DESC
                    LIMIT 1
                    """
                )
                row = cur.fetchone()

                if row:
                    enabled = (row[3] or "").lower() == "active"
                    return JsonResponse({
                        "ok": True,
                        "enabled": enabled,
                        "admin_ip": row[0],
                        "request_ip": request_ip,
                        "current_ip": request_ip,
                        "allowed_prefix": row[1],
                        "ssid": row[2],
                        "status": row[3],
                        "networks": networks,
                    })
                else:
                    return JsonResponse({
                        "ok": True,
                        "enabled": False,
                        "admin_ip": None,
                        "request_ip": request_ip,
                        "current_ip": request_ip,
                        "allowed_prefix": None,
                        "networks": networks,
                    })
        except Exception as e:
            return JsonResponse({"ok": False, "error": str(e)}, status=500)

    if request.method == "DELETE":
        try:
            payload = json.loads((request.body or b"{}").decode("utf-8"))
        except Exception:
            payload = {}

        network_id = payload.get("id") or request.GET.get("id")
        if not network_id:
            return JsonResponse({"ok": False, "error": "Network id is required."}, status=400)

        try:
            with connection.cursor() as cur:
                _ensure_network_authorization_tables(cur)
                cur.execute("DELETE FROM authorized_networks WHERE id = %s", [network_id])
                deleted = cur.rowcount
            return JsonResponse({"ok": True, "deleted": deleted})
        except Exception as e:
            return JsonResponse({"ok": False, "error": str(e)}, status=500)

    # POST - Update settings
    try:
        payload = json.loads((request.body or b"{}").decode("utf-8"))
    except Exception:
        payload = {}

    enabled = bool(payload.get("enabled", False))
    requested_ip = (payload.get("network_ip") or "").strip()

    # Get admin's IP address
    admin_ip = requested_ip or _get_request_ip(request)

    # Calculate allowed prefix (first 3 octets for /24 network)
    allowed_prefix = (payload.get("ip_prefix") or "").strip() or None
    if admin_ip and "." in admin_ip:
        allowed_prefix = allowed_prefix or ".".join(admin_ip.split(".")[:3])
    elif admin_ip:
        allowed_prefix = allowed_prefix or admin_ip

    try:
        with connection.cursor() as cur:
            _ensure_network_authorization_tables(cur)
            cur.execute(
                """
                INSERT INTO authorized_networks (network_ip, ip_prefix, ssid, status, created_at, updated_at)
                VALUES (%s::inet, %s, %s, %s, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                RETURNING id
                """,
                [
                    admin_ip,
                    allowed_prefix,
                    (payload.get("ssid") or "").strip() or None,
                    payload.get("status") or ("Active" if enabled else "Disabled"),
                ],
            )
            network_id = cur.fetchone()[0]

        return JsonResponse({
            "ok": True,
            "enabled": enabled,
            "admin_ip": admin_ip,
            "allowed_prefix": allowed_prefix,
            "network_id": network_id,
            "status": "Active" if enabled else "Disabled",
        })
    except Exception as e:
        return JsonResponse({"ok": False, "error": str(e)}, status=500)


@csrf_exempt
@require_http_methods(["GET"])
def admin_network_logs_api(request):
    """Get network access logs."""
    forbidden = _require_admin(request)
    if forbidden:
        return forbidden

    try:
        with connection.cursor() as cur:
            _ensure_network_authorization_tables(cur)
            cur.execute(
                """
                SELECT student_id, ip_address::text, status, message, created_at
                FROM network_access_attempts
                ORDER BY created_at DESC, id DESC
                LIMIT 100
                """
            )

            rows = cur.fetchall()
            logs = []
            for row in rows:
                status = row[2] or ""
                logs.append({
                    "student_id": row[0],
                    "ip_address": row[1],
                    "status": status,
                    "message": row[3],
                    "allowed": status.lower() in ("allowed", "active", "authorized"),
                    "timestamp": _network_log_iso_or_none(row[4]),
                })

        return JsonResponse({"ok": True, "logs": logs})
    except Exception as e:
        return JsonResponse({"ok": False, "error": str(e)}, status=500)


@csrf_exempt
@require_http_methods(["GET", "POST"])
def check_network_access_api(request):
    """Check if current user's network is authorized to vote."""
    try:
        payload = json.loads((request.body or b"{}").decode("utf-8")) if request.body else {}
    except Exception:
        payload = {}

    request_ip = _clean_network_ip(_get_request_ip(request)) or "127.0.0.1"
    ssid = (payload.get("ssid") or request.GET.get("ssid") or "").strip() or None
    student_id = (
        request.session.get("student_id")
        or payload.get("student_id")
        or request.GET.get("student_id")
        or "unknown"
    )

    try:
        with connection.cursor() as cur:
            _ensure_network_authorization_tables(cur)
            cur.execute("SELECT COUNT(*) FROM authorized_networks WHERE LOWER(status) = 'active'")
            active_count = cur.fetchone()[0]

            if not active_count:
                return JsonResponse({
                    "ok": True,
                    "allowed": True,
                    "message": "Network authorization is not enabled"
                })

            cur.execute(
                """
                SELECT network_ip::text, ip_prefix
                FROM authorized_networks
                WHERE LOWER(status) = 'active'
                """
            )
            auth_result = _network_authorization_result(request, payload, cur.fetchall())
            allowed = auth_result["allowed"]
            user_ip = auth_result["ip"]
            ip_source = auth_result["source"]
            checked_ips = auth_result["checked"]
            message = (
                f"Network access authorized using {ip_source} IP {user_ip}"
                if allowed
                else f"You must be connected to the authorized network to vote. Checked {_network_checked_ips_message(checked_ips)}."
            )
            if ip_source == "request":
                message += " Web clients are checked by the public IP seen by the server; add that IP in Network Authorize. Mobile clients should send device_ip/local_ip for LAN Wi-Fi checks."
            elif ip_source == "server_public":
                message += " Mobile hotspot/LAN request matched the server public IP."

            # Log the attempt
            cur.execute(
                """
                INSERT INTO network_access_attempts (user_id, student_id, ip_address, ssid, status, message, created_at)
                VALUES (%s, %s, %s::inet, %s, %s, %s, CURRENT_TIMESTAMP)
                """,
                [None, student_id, user_ip, ssid, "Allowed" if allowed else "Blocked", message],
            )

            if allowed:
                return JsonResponse({
                    "ok": True,
                    "allowed": True,
                    "message": message,
                    "checked_ip": user_ip,
                    "ip_source": ip_source,
                    "checked_ips": [{"ip": ip, "source": source} for ip, source in checked_ips],
                    "request_ip": request_ip,
                })
            else:
                return JsonResponse({
                    "ok": True,
                    "allowed": False,
                    "message": message,
                    "checked_ip": user_ip,
                    "ip_source": ip_source,
                    "checked_ips": [{"ip": ip, "source": source} for ip, source in checked_ips],
                    "request_ip": request_ip,
                }, status=403)

    except Exception as e:
        return JsonResponse({"ok": False, "error": str(e)}, status=500)

# -- Forgot Password / OTP / Reset ---------------------------------------------

import random
import string
import secrets
import hashlib
from datetime import timedelta
from django.utils import timezone as dj_timezone
from django.core.mail import send_mail
from django.conf import settings as django_settings

_RESET_TOKENS: dict = {}  # { token_hash: {"student_id": ..., "expires_at": ...} }


def _mask_email(email: str) -> str:
    """Return r***@gmail.com style masked address."""
    if not email or "@" not in email:
        return "***"
    local, domain = email.rsplit("@", 1)
    keep = min(2, len(local))
    return local[:keep] + "***@" + domain


def _generate_otp(length: int = 6) -> str:
    return "".join(random.choices(string.digits, k=length))


def _make_reset_token(student_id: str) -> str:
    """Create a one-time reset token, store its hash, return the raw token."""
    raw = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(raw.encode()).hexdigest()
    expiry_minutes = int(getattr(django_settings, "RESET_TOKEN_EXPIRY_MINUTES", 15))
    _RESET_TOKENS[token_hash] = {
        "student_id": student_id,
        "expires_at": dj_timezone.now() + timedelta(minutes=expiry_minutes),
    }
    return raw


def _consume_reset_token(raw: str):
    """Validate and consume a reset token. Returns student_id or None."""
    token_hash = hashlib.sha256(raw.encode()).hexdigest()
    entry = _RESET_TOKENS.pop(token_hash, None)
    if entry is None:
        return None
    if dj_timezone.now() > entry["expires_at"]:
        return None
    return entry["student_id"]


@csrf_exempt
@require_http_methods(["POST"])
def forgot_password_send_otp_api(request):
    """
    POST /api/mobile/auth/forgot-password/
    Body: { "identifier": "<student_id or email>" }
    Response: { "ok": true, "masked_email": "r***@gmail.com" }
    Errors: 404 if no matching account; 400 if account has no email on file.
    """
    _ensure_auth_identity_tables()

    try:
        payload = json.loads((request.body or b"{}").decode("utf-8"))
    except Exception:
        return JsonResponse({"ok": False, "error": "Invalid JSON."}, status=400)

    identifier = (payload.get("identifier") or "").strip()
    if not identifier:
        return JsonResponse({"ok": False, "error": "Identifier is required."}, status=400)

    # Look up by student_id OR email (case-insensitive)
    from elecom_auth.models import ElecomUser
    user = (
        ElecomUser.objects.filter(student_id=identifier).first()
        or ElecomUser.objects.filter(email__iexact=identifier).first()
    )

    if user is None:
        return JsonResponse(
            {
                "ok": False,
                "error": "No ELECOM account matches that Student ID or email.",
            },
            status=404,
        )

    if not (user.email or "").strip():
        return JsonResponse(
            {
                "ok": False,
                "error": "This account has no email on file. Contact support to recover access.",
            },
            status=400,
        )

    otp = _generate_otp()
    expiry_minutes = int(getattr(django_settings, "OTP_EXPIRY_MINUTES", 10))

    # Persist OTP on the user row (fields already exist in ElecomUser)
    import bcrypt as _bcrypt
    otp_hash = _bcrypt.hashpw(otp.encode(), _bcrypt.gensalt()).decode()

    # Use DB clock + interval so expiry matches verify (avoids Python/ORM tz skew
    # on TIMESTAMP WITHOUT TIME ZONE vs aware datetimes).
    with connection.cursor() as cur:
        cur.execute(
            """
            UPDATE users
            SET otp_code = %s,
                otp_expires_at = NOW() + (interval '1 minute' * %s)
            WHERE id = %s
            """,
            [otp_hash, int(expiry_minutes), user.id],
        )

    # Send email
    try:
        send_mail(
            subject="ELECOM – Your OTP Code",
            message=(
                f"Your one-time password is: {otp}\n\n"
                f"It expires in {expiry_minutes} minutes.\n"
                "If you did not request this, ignore this email."
            ),
            from_email=getattr(django_settings, "DEFAULT_FROM_EMAIL", "noreply@elecom.local"),
            recipient_list=[user.email],
            fail_silently=False,
        )
    except Exception as e:
        logger.error("OTP email send failed for user %s: %s", user.id, e)
        return JsonResponse({"ok": False, "error": "Failed to send OTP email. Check server email settings."}, status=500)

    _eb = getattr(django_settings, "EMAIL_BACKEND", "") or ""
    if "console" in _eb:
        logger.warning(
            "OTP for user id=%s was not sent to any inbox: EMAIL_BACKEND=%r "
            "(only printed above). Set SMTP in .env — see settings.py email block.",
            user.id,
            _eb,
        )

    return JsonResponse({"ok": True, "masked_email": _mask_email(user.email)})


@csrf_exempt
@require_http_methods(["POST"])
def forgot_password_verify_otp_api(request):
    """
    POST /api/mobile/auth/verify-otp/
    Body: { "identifier": "<student_id or email>", "otp": "123456" }
    Response: { "ok": true, "reset_token": "<token>" }
    """
    _ensure_auth_identity_tables()

    try:
        payload = json.loads((request.body or b"{}").decode("utf-8"))
    except Exception:
        return JsonResponse({"ok": False, "error": "Invalid JSON."}, status=400)

    identifier = (payload.get("identifier") or "").strip()
    otp = (payload.get("otp") or "").strip()

    if not identifier or not otp:
        return JsonResponse({"ok": False, "error": "Identifier and OTP are required."}, status=400)

    try:
        from elecom_auth.models import ElecomUser

        user = (
            ElecomUser.objects.filter(student_id=identifier).first()
            or ElecomUser.objects.filter(email__iexact=identifier).first()
        )

        if user is None:
            return JsonResponse(
                {"ok": False, "error": "Invalid OTP code. Please try again."},
                status=400,
            )

        with connection.cursor() as cur:
            cur.execute(
                """
                SELECT otp_code,
                       CASE
                           WHEN otp_expires_at IS NULL THEN 'none'
                           WHEN otp_expires_at > NOW() THEN 'ok'
                           ELSE 'expired'
                       END AS expiry_state
                FROM users
                WHERE id = %s
                """,
                [user.id],
            )
            row = cur.fetchone()

        if not row:
            return JsonResponse(
                {"ok": False, "error": "Invalid OTP code. Please try again."},
                status=400,
            )

        stored_hash = (row[0] or "").strip()
        expiry_state = row[1]

        if not stored_hash or expiry_state == "none":
            return JsonResponse(
                {"ok": False, "error": "No OTP was requested. Please start over."},
                status=400,
            )

        if expiry_state == "expired":
            return JsonResponse(
                {"ok": False, "error": "OTP expired. Please request a new one."},
                status=400,
            )

        # Verify OTP (stored as bcrypt hash)
        import bcrypt as _bcrypt

        try:
            otp_valid = _bcrypt.checkpw(otp.encode("utf-8"), stored_hash.encode("utf-8"))
        except Exception:
            otp_valid = otp == stored_hash  # plain-text fallback

        if not otp_valid:
            return JsonResponse(
                {"ok": False, "error": "Invalid OTP code. Please try again."},
                status=400,
            )

        # Clear OTP so it can't be reused
        with connection.cursor() as cur:
            cur.execute(
                "UPDATE users SET otp_code = NULL, otp_expires_at = NULL WHERE id = %s",
                [user.id],
            )

        reset_token = _make_reset_token(str(user.student_id or user.id))
        return JsonResponse({"ok": True, "reset_token": reset_token})
    except Exception as e:
        logger.exception("forgot_password_verify_otp_api failed: %s", e)
        return JsonResponse(
            {
                "ok": False,
                "error": "Could not verify OTP. Please try again in a moment.",
            },
            status=500,
        )


@csrf_exempt
@require_http_methods(["POST"])
def forgot_password_reset_password_api(request):
    """
    POST /api/mobile/auth/reset-password/
    Body: { "reset_token": "<token>", "new_password": "<password>" }
    Response: { "ok": true }
    """
    _ensure_auth_identity_tables()

    try:
        payload = json.loads((request.body or b"{}").decode("utf-8"))
    except Exception:
        return JsonResponse({"ok": False, "error": "Invalid JSON."}, status=400)

    raw_token = (payload.get("reset_token") or "").strip()
    new_password = (payload.get("new_password") or "").strip()

    if not raw_token or not new_password:
        return JsonResponse({"ok": False, "error": "Reset token and new password are required."}, status=400)

    if len(new_password) < 6:
        return JsonResponse({"ok": False, "error": "Password must be at least 6 characters."}, status=400)

    student_id = _consume_reset_token(raw_token)
    if student_id is None:
        return JsonResponse({"ok": False, "error": "Reset link is invalid or has expired. Please start over."}, status=400)

    import bcrypt as _bcrypt
    pw_hash = _bcrypt.hashpw(new_password.encode(), _bcrypt.gensalt()).decode()

    with connection.cursor() as cur:
        cur.execute(
            "UPDATE users SET password_hash = %s WHERE student_id = %s",
            [pw_hash, student_id],
        )

    return JsonResponse({"ok": True})
