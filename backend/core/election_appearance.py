"""Per-election filing slides, text presets and administrative image uploads."""
import io
import json
import re
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
    slides JSONB NULL,
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
        cur.execute('ALTER TABLE election_mobile_appearance ADD COLUMN IF NOT EXISTS slides JSONB NULL')
    if request.method == 'GET':
        return _response({'ok': True, 'election_id': election_id,
                          'background_url': get_filing_background(election_id), 'slides': get_filing_slides(election_id), 'defaults': default_slides(), 'csrfToken': get_token(request)})
    if request.method == 'DELETE':
        with connection.cursor() as cur:
            cur.execute('DELETE FROM election_mobile_appearance WHERE election_id = %s', [election_id])
        return _response({'ok': True, 'election_id': election_id, 'background_url': None, 'slides': default_slides(), 'defaults': default_slides()})
    if 'slides' in request.POST:
        return save_slide_draft(request, election_id)
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
                SET slides = NULL, filing_background_url = EXCLUDED.filing_background_url,
                    cloudinary_public_id = EXCLUDED.cloudinary_public_id, updated_at = NOW()''',
                [election_id, url, public_id])
        return _response({'ok': True, 'election_id': election_id, 'background_url': url})
    except Exception as error:
        logger.warning('Filing artwork save failed (%s)', type(error).__name__)
        return _response({'ok': False, 'error': 'Unable to save the background. Your previous image is unchanged. Please try again.'}, 503)


DEFAULT_SLIDES = [
    {'default_index': 0, 'title': 'Lead the Change', 'subtitle': 'File your candidacy and let ELECOM check your eligibility.'},
    {'default_index': 1, 'title': 'Your Voice, Your Run', 'subtitle': 'Step forward for your organization and start your filing.'},
    {'default_index': 2, 'title': 'Ready to Serve?', 'subtitle': 'Submit your details and campaign platform for review.'},
    {'default_index': 3, 'title': 'Be on the Ballot', 'subtitle': 'ELECOM will verify your requirements before publishing.'},
    {'default_index': 4, 'title': 'Make It Official', 'subtitle': 'Complete your filing and wait for ELECOM approval.'},
]


def default_slides():
    return [dict(slide, id=f'default-{index}', image_url=None, use_default_text=True) for index, slide in enumerate(DEFAULT_SLIDES)]


def get_filing_slides(election_id):
    if not election_id:
        return default_slides()
    try:
        with connection.cursor() as cur:
            cur.execute('SELECT slides, filing_background_url FROM election_mobile_appearance WHERE election_id = %s', [election_id])
            row = cur.fetchone()
        if row:
            slides = json.loads(row[0]) if isinstance(row[0], str) else row[0]
            if isinstance(slides, list) and 1 <= len(slides) <= 10:
                # Stored slides already contain validated text and permitted image URLs.
                return [{key: slide.get(key) for key in ('id', 'default_index', 'title', 'subtitle', 'image_url', 'use_default_text')} for slide in slides]
            if safe_background_url(row[1]):
                return [dict(default_slides()[2], id='legacy-background', image_url=row[1])]
    except Exception:
        pass
    return default_slides()


def validate_slide_draft(raw, existing):
    try:
        slides = json.loads(raw)
    except (TypeError, ValueError) as error:
        raise ValueError('The slideshow data is invalid.') from error
    if not isinstance(slides, list) or not 1 <= len(slides) <= 10:
        raise ValueError('Keep between 1 and 10 slides.')
    allowed_images = {slide.get('image_url') for slide in existing if slide.get('image_url')}
    result, ids = [], set()
    for slide in slides:
        if not isinstance(slide, dict):
            raise ValueError('Each slide must contain valid settings.')
        sid = slide.get('id')
        if not isinstance(sid, str) or not re.fullmatch(r'[a-zA-Z0-9_-]{1,64}', sid) or sid in ids:
            raise ValueError('Slide identifiers must be unique.')
        ids.add(sid)
        index = slide.get('default_index')
        if type(index) is not int or not 0 <= index < len(DEFAULT_SLIDES):
            raise ValueError('Choose one of the provided default designs.')
        use_default = slide.get('use_default_text', False)
        if not isinstance(use_default, bool):
            raise ValueError('Choose default or custom text for each slide.')
        title = DEFAULT_SLIDES[index]['title'] if use_default else slide.get('title')
        subtitle = DEFAULT_SLIDES[index]['subtitle'] if use_default else slide.get('subtitle')
        if not isinstance(title, str) or not 1 <= len(title.strip()) <= 60:
            raise ValueError('Each title must contain 1 to 60 characters.')
        if not isinstance(subtitle, str) or not 1 <= len(subtitle.strip()) <= 160:
            raise ValueError('Each description must contain 1 to 160 characters.')
        image_url = slide.get('image_url') or None
        if image_url is not None and (not isinstance(image_url, str) or image_url not in allowed_images or not safe_background_url(image_url)):
            raise ValueError('Upload a new image or keep a saved image; external image URLs are not accepted.')
        result.append({'id': sid, 'default_index': index, 'use_default_text': use_default,
                       'title': title.strip(), 'subtitle': subtitle.strip(), 'image_url': image_url})
    return result


def save_slide_draft(request, election_id):
    try:
        slides = validate_slide_draft(request.POST.get('slides'), get_filing_slides(election_id))
        expected = {f"image_{slide['id']}" for slide in slides}
        if set(request.FILES) - expected:
            raise ValueError('An uploaded image does not belong to a slide.')
        if sum(upload.size for upload in request.FILES.values()) > 15 * 1024 * 1024:
            raise ValueError('Save no more than 15 MB of new images at once.')
        # Validate every file before starting any remote upload or database save.
        images = {slide['id']: validated_background(request.FILES[f"image_{slide['id']}"])
                  for slide in slides if f"image_{slide['id']}" in request.FILES}
    except ValueError as error:
        return _response({'ok': False, 'error': str(error)}, 400)
    try:
        for slide in slides:
            if slide['id'] in images:
                url, _ = upload_image_bytes(images[slide['id']], folder=f'elecom/election_appearance/{election_id}')
                if not safe_background_url(url):
                    raise ValueError('Invalid image delivery URL')
                slide['image_url'] = url
        first_url = slides[0]['image_url'] or ''
        with connection.cursor() as cur:
            cur.execute('''INSERT INTO election_mobile_appearance
                (election_id, filing_background_url, cloudinary_public_id, slides)
                VALUES (%s, %s, %s, %s::jsonb) ON CONFLICT (election_id) DO UPDATE
                SET filing_background_url = EXCLUDED.filing_background_url,
                    slides = EXCLUDED.slides, cloudinary_public_id = EXCLUDED.cloudinary_public_id, updated_at = NOW()''',
                [election_id, first_url, '', json.dumps(slides)])
        return _response({'ok': True, 'election_id': election_id, 'background_url': first_url or None, 'slides': slides})
    except Exception as error:
        logger.warning('Filing slideshow save failed (%s)', type(error).__name__)
        return _response({'ok': False, 'error': 'Unable to publish the slideshow. The previous saved slides are unchanged.'}, 503)
