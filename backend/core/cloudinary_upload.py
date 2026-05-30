"""Server-side Cloudinary uploads (credentials stay in Django settings / .env)."""
from __future__ import annotations

import io

from django.conf import settings


def upload_image_bytes(image_bytes: bytes, *, folder: str) -> tuple[str, str]:
    """Upload raw image bytes to the given Cloudinary folder."""
    try:
        import cloudinary
        import cloudinary.uploader
    except ImportError as e:
        raise RuntimeError("Install cloudinary: pip install cloudinary") from e

    cloud_name = (getattr(settings, "CLOUDINARY_CLOUD_NAME", None) or "").strip()
    if not cloud_name:
        raise RuntimeError("Cloudinary is not configured.")

    cloudinary.config(
        cloud_name=cloud_name,
        api_key=getattr(settings, "CLOUDINARY_API_KEY", ""),
        api_secret=getattr(settings, "CLOUDINARY_API_SECRET", ""),
    )
    result = cloudinary.uploader.upload(
        io.BytesIO(image_bytes),
        folder=folder,
        resource_type="image",
    )
    secure_url = str(result.get("secure_url") or result.get("url") or "").strip()
    public_id = str(result.get("public_id") or "").strip()
    if not secure_url:
        raise RuntimeError("Cloudinary upload did not return a URL.")
    return secure_url, public_id


def upload_enrollment_image_bytes(image_bytes: bytes) -> tuple[str, str]:
    """Upload raw image bytes; return ``(secure_url, public_id)``."""
    return upload_image_bytes(image_bytes, folder="elecom/face_enrollments")
