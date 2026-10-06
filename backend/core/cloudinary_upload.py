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


def upload_raw_bytes(file_bytes: bytes, *, folder: str, filename: str) -> tuple[str, str]:
    """Upload a non-image document such as a PDF to Cloudinary."""
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
        io.BytesIO(file_bytes),
        folder=folder,
        resource_type="raw",
        # Raw Cloudinary assets keep the extension as part of their public ID.
        public_id=filename,
        overwrite=True,
    )
    secure_url = str(result.get("secure_url") or result.get("url") or "").strip()
    public_id = str(result.get("public_id") or "").strip()
    if not secure_url:
        raise RuntimeError("Cloudinary upload did not return a URL.")
    return secure_url, public_id


def read_candidate_document(file_url: str, public_id: str | None, *, photo: bool) -> tuple[bytes, str]:
    """Fetch a stored Cloudinary asset; signed API delivery handles restricted PDFs."""
    import time
    import urllib.parse
    import urllib.request
    import cloudinary
    import cloudinary.utils

    cloud_name = str(getattr(settings, "CLOUDINARY_CLOUD_NAME", "") or "").strip()
    parsed = urllib.parse.urlsplit(file_url)
    parts = parsed.path.strip("/").split("/")
    if (parsed.scheme != "https" or parsed.netloc != "res.cloudinary.com"
            or len(parts) < 4 or parts[0] != cloud_name or parts[1] not in {"image", "raw"}
            or parts[2] not in {"upload", "private", "authenticated"}):
        raise ValueError("This file is not stored in the configured document service.")
    delivery_url = file_url
    if not photo:
        # Raw public IDs include the .pdf extension. Use the authenticated
        # download API instead of embedding a publicly blocked CDN URL.
        resource_type, delivery_type = parts[1], parts[2]
        asset_parts = parts[3:]
        if asset_parts[0].startswith("v") and asset_parts[0][1:].isdigit():
            asset_parts = asset_parts[1:]
        asset_id = public_id or urllib.parse.unquote("/".join(asset_parts))
        if resource_type == "image" and asset_id.lower().endswith(".pdf"):
            asset_id = asset_id[:-4]
        cloudinary.config(cloud_name=cloud_name,
            api_key=getattr(settings, "CLOUDINARY_API_KEY", ""),
            api_secret=getattr(settings, "CLOUDINARY_API_SECRET", ""))
        delivery_url = cloudinary.utils.private_download_url(asset_id, "" if resource_type == "raw" else "pdf",
            resource_type=resource_type, type=delivery_type, expires_at=int(time.time()) + 60, attachment=False)
    with urllib.request.urlopen(delivery_url, timeout=20) as response:
        raw = response.read(12 * 1024 * 1024 + 1)
    if not raw or len(raw) > 12 * 1024 * 1024:
        raise ValueError("This file is empty or too large to preview.")
    if photo:
        if raw.startswith(b"\x89PNG\r\n\x1a\n"):
            return raw, "image/png"
        if raw.startswith(b"\xff\xd8\xff"):
            return raw, "image/jpeg"
    elif raw.startswith(b"%PDF-"):
        return raw, "application/pdf"
    raise ValueError("The stored file is not a supported photo or PDF.")
