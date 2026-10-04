"""
Local face verification service using the `face_recognition` library (dlib-based).

This replaces Face++ entirely — no external API calls, no rate limits, no cost.

Encoding:
  - A 128-dimensional float64 vector is computed from a face image using
    dlib's ResNet face-recognition model (same algorithm Face++ uses internally).
  - The encoding is stored as a JSON array in FaceEnrollment.face_encoding.

Verification:
  - Euclidean distance between the enrolled encoding and a live capture encoding.
  - Threshold 0.50 (conservative) — equivalent to Face++'s ~80 confidence level.
    Lower distance = better match. 0.6 is the library's default; we use 0.50 for
    stricter security suitable for an election system.

Duplicate detection:
  - All active enrolled encodings are loaded from the DB and compared against
    the new encoding. If any match above threshold, enrollment is rejected.
    This runs in O(n) over the number of enrolled voters — typically < 2000 for
    a campus election, fast enough without a vector index.
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

# Maximum Euclidean distance to accept as a face match.
# Lower = stricter. 0.50 is tighter than face_recognition's default 0.60,
# appropriate for a campus election where security matters.
MATCH_THRESHOLD = 0.50


class LocalFaceError(Exception):
    """Raised when face detection or comparison fails."""

    def __init__(self, message: str, code: str = "face_error"):
        self.message = message
        self.code = code
        super().__init__(message)


def _import_face_recognition():
    """Lazy import so the module loads even if face_recognition is not installed."""
    try:
        import face_recognition  # type: ignore
        return face_recognition
    except ImportError as e:
        raise LocalFaceError(
            "Face recognition library is not installed on the server. "
            "Run: pip install face_recognition",
            "library_missing",
        ) from e


def encode_face_bytes(image_bytes: bytes) -> list[float]:
    """
    Detect the primary face in `image_bytes` and return its 128-d encoding.

    Raises LocalFaceError if no face is found or the library is unavailable.
    """
    fr = _import_face_recognition()

    if not image_bytes or len(image_bytes) < 512:
        raise LocalFaceError("Image is too small or empty.", "face_invalid_image")

    try:
        img = fr.load_image_file(io.BytesIO(image_bytes))
    except Exception as e:
        raise LocalFaceError(f"Could not decode image: {e}", "face_decode_error") from e

    # Use HOG model (fast, CPU-friendly) for campus-scale usage.
    # Switch to "cnn" if a GPU is available for better accuracy.
    encodings = fr.face_encodings(img, model="large", num_jitters=2)
    if not encodings:
        raise LocalFaceError(
            "No face detected in the image. "
            "Please center your face and ensure good lighting.",
            "no_face",
        )

    # Always take the first (largest) detected face.
    return encodings[0].tolist()


def encode_face_url(image_url: str) -> list[float]:
    """Download an image from `image_url` and return its 128-d face encoding."""
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
    Compare two 128-d face encodings.

    Returns (matched: bool, distance: float).
    Lower distance = better match. Passes when distance < threshold.
    """
    enc1 = np.array(enrolled_encoding, dtype=np.float64)
    enc2 = np.array(live_encoding, dtype=np.float64)
    distance = float(np.linalg.norm(enc1 - enc2))
    return distance < threshold, distance


def encoding_from_json(json_str: Optional[str]) -> Optional[list[float]]:
    """Parse a JSON-encoded face vector from the DB. Returns None on any error."""
    if not json_str:
        return None
    try:
        parsed = json.loads(json_str)
        if isinstance(parsed, list) and len(parsed) == 128:
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
    Check whether `new_encoding` matches any *other* active student's enrollment.

    Returns the matched `student_id` string if a duplicate is found, else None.
    Loads all active enrollments with a non-null encoding from the DB.
    """
    # Import here to avoid circular imports at module load time.
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
        matched, _ = compare_encodings(existing, new_encoding, threshold)
        if matched:
            return sid

    return None


def is_available() -> bool:
    """Return True if face_recognition is importable (library installed)."""
    try:
        _import_face_recognition()
        return True
    except LocalFaceError:
        return False
