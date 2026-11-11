"""Election-scoped mobile Home header background."""
import logging
from django.db import connection
from django.middleware.csrf import get_token
from django.views.decorators.http import require_http_methods
from .election_appearance import _response, safe_background_url, validated_background
from .cloudinary_upload import upload_image_bytes
logger = logging.getLogger(__name__)
TABLE_SQL = "CREATE TABLE IF NOT EXISTS election_topbar_appearance (election_id BIGINT PRIMARY KEY, image_url TEXT NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())"

def get_topbar_background(election_id):
    if not election_id:
        return None
    try:
        with connection.cursor() as cur:
            cur.execute('SELECT image_url FROM election_topbar_appearance WHERE election_id = %s', [election_id])
            row = cur.fetchone()
        return (safe_background_url(row[0]) or None) if row else None
    except Exception:
        return None

@require_http_methods(['GET', 'POST', 'DELETE'])
def topbar_appearance_api(request, election_id):
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
        return _response({'ok': True, 'image_url': get_topbar_background(election_id), 'csrfToken': get_token(request)})
    if request.method == 'DELETE':
        with connection.cursor() as cur:
            cur.execute('DELETE FROM election_topbar_appearance WHERE election_id = %s', [election_id])
        return _response({'ok': True, 'image_url': None})
    try:
        if set(request.FILES) != {'background'}:
            raise ValueError('Select one background image.')
        raw = validated_background(request.FILES.get('background'))
    except ValueError as error:
        return _response({'ok': False, 'error': str(error)}, 400)
    try:
        url, _ = upload_image_bytes(raw, folder=f'elecom/topbar/{election_id}')
        if not safe_background_url(url):
            raise ValueError('Invalid uploaded URL.')
        with connection.cursor() as cur:
            cur.execute("INSERT INTO election_topbar_appearance (election_id, image_url) VALUES (%s, %s) ON CONFLICT (election_id) DO UPDATE SET image_url=EXCLUDED.image_url, updated_at=NOW()", [election_id, url])
        return _response({'ok': True, 'image_url': url})
    except Exception as error:
        logger.warning('Top bar upload failed: %s', type(error).__name__)
        return _response({'ok': False, 'error': 'Unable to save. The previous background is unchanged.'}, 503)
