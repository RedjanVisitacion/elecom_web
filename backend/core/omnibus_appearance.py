"""Per-election Omnibus page order and validated image uploads."""
import json
import logging
import re
from django.db import connection
from django.middleware.csrf import get_token
from django.views.decorators.http import require_http_methods
from .election_appearance import _response, safe_background_url, validated_background
from .cloudinary_upload import upload_image_bytes

logger = logging.getLogger(__name__)
TABLE_SQL = "CREATE TABLE IF NOT EXISTS election_omnibus_pages (election_id BIGINT PRIMARY KEY, pages JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())"

def default_pages():
    return [dict(id=f'default-{i}', default_index=i, image_url=None) for i in range(14)]

def get_omnibus_pages(election_id):
    if not election_id:
        return default_pages()
    try:
        with connection.cursor() as cur:
            cur.execute('SELECT pages FROM election_omnibus_pages WHERE election_id = %s', [election_id])
            row = cur.fetchone()
        if row:
            pages = json.loads(row[0]) if isinstance(row[0], str) else row[0]
            return validate_pages(pages, pages)
    except Exception:
        pass
    return default_pages()

def validate_pages(raw, existing):
    pages = json.loads(raw) if isinstance(raw, str) else raw
    if not isinstance(pages, list) or not 1 <= len(pages) <= 30:
        raise ValueError('Keep between 1 and 30 pages.')
    allowed = {page.get('image_url') for page in existing if isinstance(page, dict)}
    result, ids = [], set()
    for page in pages:
        if not isinstance(page, dict):
            raise ValueError('Invalid page.')
        ident, index, url = page.get('id'), page.get('default_index'), page.get('image_url')
        if not isinstance(ident, str) or not re.fullmatch(r'[A-Za-z0-9_-]{1,64}', ident) or ident in ids:
            raise ValueError('Each page needs a unique ID.')
        if index is not None and (type(index) is not int or not 0 <= index < 14):
            raise ValueError('Invalid default page.')
        if url and (not isinstance(url, str) or url not in allowed or not safe_background_url(url)):
            raise ValueError('Upload images using the page editor.')
        ids.add(ident)
        result.append(dict(id=ident, default_index=index, image_url=url or None))
    return result

@require_http_methods(['GET', 'POST', 'DELETE'])
def omnibus_appearance_api(request, election_id):
    from .views import _require_admin
    forbidden = _require_admin(request)
    if forbidden is not None:
        return forbidden
    with connection.cursor() as cur:
        cur.execute('SELECT id FROM vote_windows WHERE id = %s', [election_id])
        if cur.fetchone() is None:
            return _response({'ok': False, 'error': 'Election not found.'}, 404)
        cur.execute(TABLE_SQL)
    if request.method == 'DELETE':
        with connection.cursor() as cur:
            cur.execute('DELETE FROM election_omnibus_pages WHERE election_id = %s', [election_id])
        return _response({'ok': True, 'pages': default_pages()})
    if request.method == 'GET':
        return _response({'ok': True, 'pages': get_omnibus_pages(election_id), 'csrfToken': get_token(request)})
    try:
        pages = validate_pages(request.POST.get('pages', ''), get_omnibus_pages(election_id))
        expected = {f"image_{page['id']}" for page in pages}
        if set(request.FILES) - expected:
            raise ValueError('Unknown page upload.')
        if sum(upload.size for upload in request.FILES.values()) > 15 * 1024 * 1024:
            raise ValueError('Upload no more than 15 MB per save.')
        images = {page['id']: validated_background(request.FILES[f"image_{page['id']}"]) for page in pages if f"image_{page['id']}" in request.FILES}
        if any(page['default_index'] is None and not page['image_url'] and page['id'] not in images for page in pages):
            raise ValueError('Upload an image for each new page.')
    except (ValueError, TypeError) as error:
        return _response({'ok': False, 'error': str(error)}, 400)
    try:
        for page in pages:
            if page['id'] in images:
                url, _ = upload_image_bytes(images[page['id']], folder=f'elecom/omnibus/{election_id}')
                if not safe_background_url(url):
                    raise ValueError('Invalid uploaded image URL.')
                page['image_url'] = url
        with connection.cursor() as cur:
            cur.execute("INSERT INTO election_omnibus_pages (election_id, pages) VALUES (%s, %s::jsonb) ON CONFLICT (election_id) DO UPDATE SET pages=EXCLUDED.pages, updated_at=NOW()", [election_id, json.dumps(pages)])
        return _response({'ok': True, 'pages': pages})
    except Exception as error:
        logger.warning('Omnibus publish failed: %s', type(error).__name__)
        return _response({'ok': False, 'error': 'Unable to publish. Previously saved pages are unchanged.'}, 503)
