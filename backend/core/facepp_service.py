"""
Face++ (Megvii) API helpers for enrollment duplicate detection and vote verification.

Credentials and thresholds come from Django settings / backend .env only.
"""
from __future__ import annotations

import base64
import json
import logging

import urllib.error
import urllib.parse
import urllib.request

from django.conf import settings

logger = logging.getLogger(__name__)


class FacePPError(Exception):
    """Raised when Face++ returns an error or the response is unusable."""

    def __init__(self, message: str, code: str | None = None):
        self.message = message
        self.code = code
        super().__init__(message)


def _credentials() -> tuple[str, str]:
    key = (getattr(settings, "FACEPP_API_KEY", None) or "").strip()
    secret = (getattr(settings, "FACEPP_API_SECRET", None) or "").strip()
    if not key or not secret:
        raise FacePPError("Face++ is not configured on the server.", "facepp_not_configured")
    return key, secret


def _base_url() -> str:
    return (
        getattr(settings, "FACEPP_API_BASE", None) or "https://api-us.faceplusplus.com/facepp/v3"
    ).rstrip("/")


def _faceset_outer_id() -> str:
    return (getattr(settings, "FACEPP_FACESET_OUTER_ID", None) or "elecom_voters").strip()


def _duplicate_threshold() -> float:
    try:
        return float(getattr(settings, "FACEPP_DUPLICATE_THRESHOLD", 80))
    except (TypeError, ValueError):
        return 80.0


def _verify_threshold() -> float:
    try:
        return float(getattr(settings, "FACEPP_VERIFY_THRESHOLD", 80))
    except (TypeError, ValueError):
        return 80.0


def _post(api_method: str, fields: dict, image_bytes: bytes | None = None) -> dict:
    key, secret = _credentials()
    payload = {"api_key": key, "api_secret": secret, **fields}
    if image_bytes is not None:
        payload["image_base64"] = base64.b64encode(image_bytes).decode("ascii")

    data = urllib.parse.urlencode(payload).encode("utf-8")
    url = f"{_base_url()}/{api_method.lstrip('/')}"
    req = urllib.request.Request(
        url,
        data=data,
        method="POST",
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    try:
        with urllib.request.urlopen(req, timeout=90) as resp:
            raw = resp.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", errors="replace")
        try:
            j = json.loads(raw)
            msg = (j.get("error_message") or j.get("error") or raw or "Face++ HTTP error").strip()
            raise FacePPError(msg, "facepp_http_error") from e
        except FacePPError:
            raise
        except Exception:
            raise FacePPError(raw or "Face++ HTTP error", "facepp_http_error") from e
    except urllib.error.URLError as e:
        raise FacePPError(f"Face++ network error: {e}", "facepp_network") from e

    try:
        out = json.loads(raw)
    except json.JSONDecodeError as e:
        raise FacePPError("Face++ returned invalid JSON.", "facepp_bad_json") from e

    err = (out.get("error_message") or "").strip()
    if err:
        raise FacePPError(err, "facepp_api_error")
    return out


def detect_face_bytes(image_bytes: bytes) -> str:
    """Run Detect API on raw image bytes; return primary ``face_token``."""
    if not image_bytes or len(image_bytes) < 512:
        raise FacePPError("Image data is too small.", "face_invalid_image")
    j = _post("detect", {"return_landmark": 0}, image_bytes)
    faces = j.get("faces") or []
    if not faces:
        raise FacePPError("No face detected.", "no_face")
    token = (faces[0].get("face_token") or "").strip()
    if not token:
        raise FacePPError("No face token returned.", "no_face_token")
    return token


def detect_face_detail_bytes(image_bytes: bytes) -> dict:
    """Run Detect API and return token plus Face++ rectangle details."""
    if not image_bytes or len(image_bytes) < 512:
        raise FacePPError("Image data is too small.", "face_invalid_image")
    try:
        j = _post(
            "detect",
            {
                "return_landmark": 0,
                "return_attributes": "eyestatus,mask,mouthstatus,facequality",
            },
            image_bytes,
        )
    except FacePPError as e:
        msg = (e.message or "").upper()
        if "ATTRIBUTE" not in msg and "ARGUMENT" not in msg:
            raise
        j = _post("detect", {"return_landmark": 0}, image_bytes)
    faces = j.get("faces") or []
    if not faces:
        raise FacePPError("No face detected.", "no_face")
    face = faces[0] or {}
    token = (face.get("face_token") or "").strip()
    rect = face.get("face_rectangle") or {}
    attrs = face.get("attributes") or {}
    if not token:
        raise FacePPError("No face token returned.", "no_face_token")
    return {
        "face_token": token,
        "rectangle": {
            "top": int(rect.get("top") or 0),
            "left": int(rect.get("left") or 0),
            "width": int(rect.get("width") or 0),
            "height": int(rect.get("height") or 0),
        },
        "attributes": attrs,
    }


def detect_face(image_file):
    """
    Detect face from an uploaded file-like object (``read()``) or ``bytes``.
    Matches the enrollment / verification pipeline contract (Flutter → multipart → Django).
    """
    if isinstance(image_file, (bytes, bytearray)):
        return detect_face_bytes(bytes(image_file))
    if hasattr(image_file, "read"):
        raw = image_file.read()
        if not isinstance(raw, (bytes, bytearray)):
            raise FacePPError("Invalid image file.", "face_invalid_image")
        return detect_face_bytes(bytes(raw))
    raise FacePPError("Invalid image file.", "face_invalid_image")


def detect_face_file(image_file) -> str:
    """Compatibility alias for :func:`detect_face`."""
    return detect_face(image_file)


def create_faceset_if_missing() -> None:
    """Ensure the configured outer_id FaceSet exists."""
    outer_id = _faceset_outer_id()
    try:
        detail = _post("faceset/getdetail", {"outer_id": outer_id})
        if detail.get("faceset_token"):
            return
    except FacePPError:
        pass
    _post("faceset/create", {"outer_id": outer_id})
    logger.info("Face++ faceset created outer_id=%s", outer_id)


def search_duplicate_face(face_token: str) -> list[dict]:
    """
    Search the voter FaceSet for faces similar to ``face_token``.
    Results are Face++ ``results`` entries (``face_token``, ``confidence``, ...).
    """
    outer_id = _faceset_outer_id()
    # Keep payload minimal for maximum compatibility across Face++ regions / plans.
    # Some deployments reject optional fields (e.g. return_result_count / threshold)
    # with BAD_ARGUMENTS even though they are documented.
    j = _post(
        "search",
        {
            "outer_id": outer_id,
            "face_token": face_token,
        },
    )
    return list(j.get("results") or [])


def add_face_to_faceset(face_token: str) -> None:
    outer_id = _faceset_outer_id()
    _post("faceset/addface", {"outer_id": outer_id, "face_tokens": face_token})
    logger.info("Face++ addface outer_id=%s", outer_id)


def set_face_userid(face_token: str, user_id: str) -> None:
    """
    Attach an application-level identifier to a face token.
    We store student_id here so Search results can identify ownership even if DB rows are missing.
    """
    uid = (user_id or "").strip()
    if not uid:
        return
    _post("face/setuserid", {"face_token": face_token, "user_id": uid})


def remove_face_from_faceset(face_token: str) -> None:
    if not (face_token or "").strip():
        return
    outer_id = _faceset_outer_id()
    try:
        _post("faceset/removeface", {"outer_id": outer_id, "face_tokens": face_token})
        logger.info("Face++ removeface outer_id=%s", outer_id)
    except FacePPError as e:
        logger.warning("Face++ removeface skipped: %s", e.message)


def compare_faces(face_token_1: str, face_token_2: str) -> float:
    """Return Face++ compare confidence (typically 0–100)."""
    j = _post(
        "compare",
        {
            # Face++ expects these exact parameter names (no underscores).
            "face_token1": face_token_1,
            "face_token2": face_token_2,
        },
    )
    try:
        return float(j.get("confidence") or 0.0)
    except (TypeError, ValueError):
        return 0.0
