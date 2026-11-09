"""Per-election filing-card artwork; image uploads are administrative only."""
import io
import logging
from urllib.parse import urlsplit

from django.db import connection
from django.http import JsonResponse
from django.middleware.csrf import get_token
from django.views.decorators.http import require_http_methods
from PIL import Image, ImageOps, UnidentifiedImageError

from .cloudinary_upload import upload_image_bytes

logger = logging.getLogger(__name__)
MAX_BYTES = 5 * 1024 * 1024
TABLE_SQL = '''CREATE TABLE IF NOT EXISTS election_mobile_appearance (
    election_id BIGINT PRIMARY KEY,
    filing_background_url TEXT NOT NULL,
    cloudinary_public_id TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)'''


def safe_background_url(value):
    parsed = urlsplit(str(value or ''))
    return str(value) if (parsed.scheme == 'https' and parsed.netloc == 'res.cloudinary.com') else ''


def get_filing_background(election_id):
    if not election_id:
        return None
    try:
        with connection.cursor() as cur:
            cur.execute('SELECT filing_background_url FROM election_mobile_appearance WHERE election_id = %s', [election_id])
            row = cur.fetchone()
        return safe_background_url(row[0]) or None if row else None
    except Exception:
        # Existing APK/API flows still work before the appearance migration/setup.
        return None


def validated_background(upload):
    if upload is None:
        raise ValueError('Select a JPG, PNG or WebP image.')
    if upload.size > MAX_BYTES:
        raise ValueError('The background must be 5 MB or smaller.')
    raw = upload.read(MAX_BYTES + 1)
    if not raw or len(raw) > MAX_BYTES:
        raise ValueError('The background is empty or exceeds 5 MB.')
    try:
        image = Image.open(io.BytesIO(raw))
        if image.format not in {'JPEG', 'PNG', 'WEBP'}:
            raise ValueError('Use a JPG, PNG or WebP image.')
        width, height = image.size
        if min(width, height) < 100 or max(width, height) > 4096:
            raise ValueError('Image dimensions must be between 100 and 4096 pixels on each side.')
        image.verify()
        # Re-encode to remove metadata and reject broken image content before upload.
        with Image.open(io.BytesIO(raw)) as original:
            image = ImageOps.exif_transpose(original).convert('RGB')
            image.thumbnail((1600, 1600))
            result = io.BytesIO()
            image.save(result, format='JPEG', quality=90)
            return result.getvalue()
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as error:
        raise ValueError('The selected file is not a valid supported image.') from error


def _response(data, status=200):
    response = JsonResponse(data, status=status)
    response['Cache-Control'] = 'private, no-store'
    return response


@require_http_methods(['GET', 'POST', 'DELETE'])
def election_appearance_api(request, election_id):
    from .views import _require_admin
    forbidden = _require_admin(request)
    if forbidden is not None:
        return forbidden
    with connection.cursor() as cur:
        cur.execute('SELECT id FROM vote_windows WHERE id = %s', [election_id])
        if cur.fetchone() is None:
            return _response({'ok': False, 'error': 'Election not found.'}, 404)
        cur.execute(TABLE_SQL)
    if request.method == 'GET':
        return _response({'ok': True, 'election_id': election_id,
                          'background_url': get_filing_background(election_id), 'csrfToken': get_token(request)})
    if request.method == 'DELETE':
        with connection.cursor() as cur:
            cur.execute('DELETE FROM election_mobile_appearance WHERE election_id = %s', [election_id])
        return _response({'ok': True, 'election_id': election_id, 'background_url': None})
    try:
        raw = validated_background(request.FILES.get('background'))
    except ValueError as error:
        return _response({'ok': False, 'error': str(error)}, 400)
    try:
        url, public_id = upload_image_bytes(raw, folder=f'elecom/election_appearance/{election_id}')
        if not safe_background_url(url):
            raise ValueError('Invalid image delivery URL')
        with connection.cursor() as cur:
            cur.execute('''INSERT INTO election_mobile_appearance
                (election_id, filing_background_url, cloudinary_public_id)
                VALUES (%s, %s, %s) ON CONFLICT (election_id) DO UPDATE
                SET filing_background_url = EXCLUDED.filing_background_url,
                    cloudinary_public_id = EXCLUDED.cloudinary_public_id, updated_at = NOW()''',
                [election_id, url, public_id])
        return _response({'ok': True, 'election_id': election_id, 'background_url': url})
    except Exception as error:
        logger.warning('Filing artwork save failed (%s)', type(error).__name__)
        return _response({'ok': False, 'error': 'Unable to save the background. Your previous image is unchanged. Please try again.'}, 503)
