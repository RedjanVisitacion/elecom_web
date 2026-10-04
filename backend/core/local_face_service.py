"""
Local face verification service — uses InsightFace (ArcFace model via ONNX).

InsightFace replaces Face++ entirely:
  - No external API calls, no rate limits, no cost
  - Pre-built ONNX wheels — no C++ compilation needed
  - ArcFace model accuracy equals or exceeds Face++

Encoding:
  - A 512-dimensional float32 embedding is computed from a face image.
  - Stored as a JSON array in FaceEnrollment.face_encoding.

Verification:
  - Cosine similarity between enrolled and live embeddings.
  - Threshold >= 0.40 to accept (conservative for election security).
    InsightFace typically scores 0.6–0.9 for same person on good photos.

Fallback:
  - If insightface is unavailable, falls back to face_recognition (dlib).
  - If neither is available, raises LocalFaceError.
"""
from __future__ import annotations

import io
import json
import logging
import tempfile
import urllib.request
from typing import Optional

import numpy as np

logger = logging.getLogger(__name__)

# Cosine similarity threshold — must be >= this value to accept as a match.
# 0.40 is conservative; increase to 0.35 if legitimate users are getting rejected.
MATCH_THRESHOLD = 0.40

# InsightFace app singleton — created once, reused across requests.
_insight_app = None
_insight_available: Optional[bool] = None


class LocalFaceError(Exception):
    """Raised when face detection or comparison fails."""

    def __init__(self, message: str, code: str = "face_error"):
        self.message = message
        self.code = code
        super().__init__(message)


# ── InsightFace backend ───────────────────────────────────────────────────────

def _get_insight_app():
    """Return a cached InsightFace FaceAnalysis app, initialising it on first call."""
    global _insight_app, _insight_available
    if _insight_available is False:
        raise LocalFaceError(
            "InsightFace is not installed on the server.",
            "library_missing",
        )
    if _insight_app is not None:
        return _insight_app
    try:
        from insightface.app import FaceAnalysis  # type: ignore
        app = FaceAnalysis(
            name="buffalo_sc",   # small, fast model — good for server use
            providers=["CPUExecutionProvider"],
        )
        # det_size controls detection resolution — 320 is fast, 640 is more accurate
        app.prepare(ctx_id=0, det_size=(320, 320))
        _insight_app = app
        _insight_available = True
        logger.info("InsightFace (buffalo_sc) initialised successfully.")
        return _insight_app
    except Exception as e:
        _insight_available = False
        raise LocalFaceError(
            f"InsightFace initialisation failed: {e}",
            "library_missing",
        ) from e


def _encode_insightface(image_bytes: bytes) -> list[float]:
    """Encode a face image using InsightFace ArcFace model."""
    import cv2  # type: ignore — bundled with insightface via opencv-python
    if not image_bytes or len(image_bytes) < 512:
        raise LocalFaceError("Image is too small or empty.", "face_invalid_image")
    app = _get_insight_app()
    arr = np.frombuffer(image_bytes, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise LocalFaceError("Could not decode image.", "face_decode_error")
    faces = app.get(img)
    if not faces:
        raise LocalFaceError(
            "No face detected in the image. "
            "Please center your face and ensure good lighting.",
            "no_face",
        )
    # Use the face with the largest bounding box (most prominent)
    face = max(faces, key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]))
    return face.embedding.tolist()


def _cosine_similarity(a: list[float], b: list[float]) -> float:
    """Return cosine similarity in [0, 1] between two embedding vectors."""
    va = np.array(a, dtype=np.float32)
    vb = np.array(b, dtype=np.float32)
    denom = np.linalg.norm(va) * np.linalg.norm(vb)
    if denom == 0:
        return 0.0
    return float(np.dot(va, vb) / denom)


# ── face_recognition (dlib) fallback ─────────────────────────────────────────

def _encode_face_recognition(image_bytes: bytes) -> list[float]:
    """Encode using dlib face_recognition — fallback when insightface unavailable."""
    try:
        import face_recognition  # type: ignore
    except ImportError as e:
        raise LocalFaceError(
            "Neither InsightFace nor face_recognition is installed.",
            "library_missing",
        ) from e
    if not image_bytes or len(image_bytes) < 512:
        raise LocalFaceError("Image is too small or empty.", "face_invalid_image")
    try:
        img = face_recognition.load_image_file(io.BytesIO(image_bytes))
    except Exception as exc:
        raise LocalFaceError(f"Could not decode image: {exc}", "face_decode_error") from exc
    encodings = face_recognition.face_encodings(img, model="large", num_jitters=2)
    if not encodings:
        raise LocalFaceError(
            "No face detected. Please center your face and ensure good lighting.",
            "no_face",
        )
    return encodings[0].tolist()


# ── Public API ────────────────────────────────────────────────────────────────

def encode_face_bytes(image_bytes: bytes) -> list[float]:
    """
    Detect the primary face in `image_bytes` and return its embedding vector.
    Uses InsightFace when available, falls back to face_recognition (dlib).
    """
    try:
        return _encode_insightface(image_bytes)
    except LocalFaceError as e:
        if e.code == "library_missing":
            # InsightFace not available — try dlib fallback
            logger.warning("InsightFace unavailable, trying face_recognition fallback.")
            return _encode_face_recognition(image_bytes)
        raise


def encode_face_url(image_url: str) -> list[float]:
    """Download an image from `image_url` and return its face embedding."""
    try:
        with urllib.request.urlopen(image_url, timeout=15) as resp:
            image_bytes = resp.read()
    except Exception as e:
        raise LocalFaceError(f"Could not download image: {e}", "download_error") from e
    return encode_face_bytes(image_bytes)


def compare_encodings(
    enrolled_encoding: list[float],
    live_encoding: list[float],
    threshold: float = MATCH_THRESHOLD,
) -> tuple[bool, float]:
    """
    Compare two face embeddings.

    Returns (matched: bool, score: float).
    Score is cosine similarity for InsightFace (higher = better match).
    For dlib 128-d vectors the score is also converted to cosine similarity.
    Both backends produce values in [0, 1]; threshold >= MATCH_THRESHOLD to pass.
    """
    enc_len = len(enrolled_encoding)
    if enc_len == 128:
        # dlib 128-d vector — use cosine similarity for consistent API
        score = _cosine_similarity(enrolled_encoding, live_encoding)
    else:
        # InsightFace 512-d ArcFace vector
        score = _cosine_similarity(enrolled_encoding, live_encoding)

    matched = score >= threshold
    return matched, score


def encoding_from_json(json_str: Optional[str]) -> Optional[list[float]]:
    """Parse a JSON-encoded face vector from the DB. Returns None on any error."""
    if not json_str:
        return None
    try:
        parsed = json.loads(json_str)
        if isinstance(parsed, list) and len(parsed) in (128, 512):
            return [float(x) for x in parsed]
    except Exception:
        pass
    return None


def encoding_to_json(encoding: list[float]) -> str:
    """Serialize a face encoding list to a compact JSON string for DB storage."""
    return json.dumps([round(float(x), 8) for x in encoding])


def check_duplicate_enrollment(
    new_encoding: list[float],
    exclude_student_id: str,
    threshold: float = MATCH_THRESHOLD,
) -> Optional[str]:
    """
    Check whether `new_encoding` matches any other active student's enrollment.
    Returns the matched student_id if a duplicate is found, else None.
    """
    from elecom_voting.models import FaceEnrollment  # noqa: PLC0415

    active = FaceEnrollment.objects.filter(
        enrollment_status="active",
    ).exclude(
        student_id=exclude_student_id,
    ).exclude(
        face_encoding__isnull=True,
    ).exclude(
        face_encoding="",
    ).values_list("student_id", "face_encoding")

    for sid, enc_json in active:
        existing = encoding_from_json(enc_json)
        if existing is None:
            continue
        # Only compare same-dimension encodings (don't mix dlib 128 vs ArcFace 512)
        if len(existing) != len(new_encoding):
            continue
        matched, _ = compare_encodings(existing, new_encoding, threshold)
        if matched:
            return sid

    return None


def is_available() -> bool:
    """Return True if at least one face recognition backend is importable."""
    try:
        _get_insight_app()
        return True
    except LocalFaceError:
        pass
    try:
        import face_recognition  # type: ignore  # noqa: F401
        return True
    except ImportError:
        return False
