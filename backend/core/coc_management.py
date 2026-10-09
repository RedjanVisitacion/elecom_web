"""Election-scoped COC settings and immutable initial-approval editions."""
import base64
from .coc_chairperson_signatures import decode_signature, read_signature, overlay_signature
import hashlib
import io
import json
from pathlib import Path
from zoneinfo import ZoneInfo

from django.conf import settings
from django.db import connection
from django.http import HttpResponse, JsonResponse
from django.middleware.csrf import get_token
from django.utils import timezone

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS candidate_certificate_settings (
    election_id INTEGER NOT NULL,
    form_kind VARCHAR(16) NOT NULL CHECK (form_kind IN ('usg', 'department')),
    academic_year_start INTEGER NOT NULL CHECK (academic_year_start BETWEEN 1900 AND 2200),
    academic_year_end INTEGER NOT NULL CHECK (academic_year_end = academic_year_start + 1),
    chairperson_name VARCHAR(120) NOT NULL,
    name_is_bold BOOLEAN NOT NULL DEFAULT FALSE,
    name_is_italic BOOLEAN NOT NULL DEFAULT FALSE,
    year_is_bold BOOLEAN NOT NULL DEFAULT FALSE,
    year_is_italic BOOLEAN NOT NULL DEFAULT FALSE,
    updated_by VARCHAR(64) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (election_id, form_kind)
);
CREATE TABLE IF NOT EXISTS candidate_certificate_issuances (
    application_id INTEGER PRIMARY KEY REFERENCES candidate_applications(id) ON DELETE RESTRICT,
    pdf_bytes BYTEA NOT NULL,
    sha256 VARCHAR(64) NOT NULL,
    settings_snapshot JSONB NOT NULL,
    initial_approved_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT issued_coc_size CHECK (octet_length(pdf_bytes) BETWEEN 1 AND 8388608)
);
"""


FORMATTING_FIELDS = ('name_is_bold', 'name_is_italic', 'year_is_bold', 'year_is_italic')


def formatting_flags(payload, query=False):
    flags = {}
    for key in FORMATTING_FIELDS:
        value = payload.get(key, False)
        if query and isinstance(value, str):
            if value.lower() not in {'true', 'false', '1', '0'}:
                raise ValueError('Formatting flags must be true or false.')
            value = value.lower() in {'true', '1'}
        if not isinstance(value, bool):
            raise ValueError('Formatting flags must be true or false.')
        flags[key] = value
    return flags


def formatting_font(config, field):
    return {
        (False, False): 'Times-Roman', (True, False): 'Times-Bold',
        (False, True): 'Times-Italic', (True, True): 'Times-BoldItalic',
    }[(config.get(field + '_is_bold', False), config.get(field + '_is_italic', False))]


def form_kind(organization):
    return 'department' if str(organization or '').strip().upper() in {'SITE', 'PAFE', 'AFPRO', 'AFPROTECHS'} else 'usg'


def read_settings(cur, election_id, kind):
    cur.execute('''SELECT academic_year_start, academic_year_end, chairperson_name,
                          name_is_bold, name_is_italic, year_is_bold, year_is_italic
                   FROM candidate_certificate_settings WHERE election_id = %s
                   ORDER BY CASE WHEN form_kind = 'usg' THEN 0 ELSE 1 END LIMIT 1''',
                [election_id or 0])
    row = cur.fetchone()
    return ({'academic_year_start': row[0], 'academic_year_end': row[1],
             'academic_year': f'{row[0]} - {row[1]}', 'chairperson_name': row[2], **dict(zip(FORMATTING_FIELDS, row[3:]))}
            if row else None)


def validate_settings(payload):
    kind = payload.get('form_kind')
    if kind not in {'usg', 'department'}:
        raise ValueError('Select the USG or department form.')
    try:
        start, end = int(payload['academic_year_start']), int(payload['academic_year_end'])
    except (KeyError, ValueError, TypeError):
        raise ValueError('Enter the academic year start and end.')
    if not 1900 <= start <= 2200 or end != start + 1:
        raise ValueError('The academic year must contain two consecutive years, for example 2025 - 2026.')
    chair = str(payload.get('chairperson_name') or '').strip()
    if not chair or len(chair) > 120 or any(ord(char) < 32 for char in chair):
        raise ValueError('Enter a chairperson name of up to 120 characters.')
    return kind, start, end, chair


def settings_response(request, election_id):
    is_admin = str(request.session.get('role') or '').lower() == 'admin'
    if request.method == 'POST' and not is_admin:
        return JsonResponse({'ok': False, 'error': 'Forbidden.'}, status=403)
    try:
        with connection.cursor() as cur:
            if request.method == 'POST':
                try:
                    payload = json.loads(request.body)
                except (ValueError, UnicodeDecodeError):
                    raise ValueError('Enter valid certificate settings.')
                if not isinstance(payload, dict):
                    raise ValueError('Enter valid certificate settings.')
                kind, start, end, chair = validate_settings(payload)
                formatting = formatting_flags(payload)
                signature_supplied = 'chairperson_signature_base64' in payload
                signature = decode_signature(payload.get('chairperson_signature_base64'))
                cur.execute('''INSERT INTO candidate_certificate_settings
                    (election_id, form_kind, academic_year_start, academic_year_end, chairperson_name, updated_by, chairperson_signature_bytes,
                     name_is_bold, name_is_italic, year_is_bold, year_is_italic)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s),
                           (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (election_id, form_kind) DO UPDATE SET
                        academic_year_start = EXCLUDED.academic_year_start,
                        academic_year_end = EXCLUDED.academic_year_end,
                        chairperson_name = EXCLUDED.chairperson_name,
                        name_is_bold = EXCLUDED.name_is_bold,
                        name_is_italic = EXCLUDED.name_is_italic,
                        year_is_bold = EXCLUDED.year_is_bold,
                        year_is_italic = EXCLUDED.year_is_italic,
                        chairperson_signature_bytes = CASE WHEN %s THEN EXCLUDED.chairperson_signature_bytes
                            ELSE candidate_certificate_settings.chairperson_signature_bytes END,
                        updated_by = EXCLUDED.updated_by, updated_at = CURRENT_TIMESTAMP''',
                    [election_id or 0, 'usg', start, end, chair, request.session['student_id'], signature, *formatting.values(),
                     election_id or 0, 'department', start, end, chair, request.session['student_id'], signature, *formatting.values(), signature_supplied])
            shared = read_settings(cur, election_id, 'usg')
            forms = {kind: shared for kind in ('usg', 'department')}
            signature, _ = read_signature(cur, election_id) if is_admin else (None, None)
        response = JsonResponse({'ok': True, 'election_id': election_id, 'forms': forms,
                                 'chairperson_signature_base64': base64.b64encode(signature).decode() if signature and is_admin else None,
                                 'date_source': 'initial_approval', 'csrf_token': get_token(request) if is_admin else None})
        response['Cache-Control'] = 'private, no-store'
        return response
    except ValueError as exc:
        return JsonResponse({'ok': False, 'error': str(exc)}, status=400)


def decorate_pdf(raw, config, approved_at=None):
    """Fill the supplied USG/department form without touching candidate fields."""
    from pypdf import PdfReader, PdfWriter
    from reportlab.pdfgen.canvas import Canvas
    from reportlab.pdfbase.pdfmetrics import stringWidth

    reader = PdfReader(io.BytesIO(raw))
    if len(reader.pages) != 1:
        raise ValueError('The COC must contain one page.')
    writer = PdfWriter()
    writer.add_page(reader.pages[0])
    page = writer.pages[0]
    width, height = float(page.mediabox.width), float(page.mediabox.height)
    if abs(width - 612) > 1 or min(abs(height - 792), abs(height - 1008)) > 1:
        raise ValueError('Use the current USG or department COC template.')
    department = height < 900
    overlay = io.BytesIO()
    canvas = Canvas(overlay, pagesize=(width, height))

    def text(value, x, top, available, size=10, center=False, erase=False, font='Times-Roman'):
        if erase:
            canvas.setFillColorRGB(1, 1, 1)
            canvas.rect(x - 0.3, height - top - 2.4, available + 0.6, 11, fill=1, stroke=0)
        canvas.setFillColorRGB(0, 0, 0)
        measured = stringWidth(value, font, size)
        font_size = min(size, size * available / measured) if measured else size
        canvas.setFont(font, font_size)
        if center:
            canvas.drawCentredString(x + available / 2, height - top, value)
        else:
            canvas.drawString(x, height - top, value)

    # Measure all inline segments together so year formatting cannot introduce
    # a gap before the department comma or overlap the remaining paragraph.
    prefix, year = 'Academic Year ', config['academic_year'].strip()
    suffix = ', and I do hereby declare my intention and desire to be' if department else ''
    x, top, available = (185.66, 589.18, 390.34) if department else (205.37, 565.51, 107.2)
    year_font = formatting_font(config, 'year')
    measured = (stringWidth(prefix + suffix, 'Times-Roman', 10)
                + stringWidth(year, year_font, 10))
    size = min(10, 10 * available / measured) if measured else 10
    canvas.setFillColorRGB(1, 1, 1)
    canvas.rect(x - 0.3, height - top - 2.4, available + 0.6, 11, fill=1, stroke=0)
    canvas.setFillColorRGB(0, 0, 0)
    canvas.setFont('Times-Roman', size)
    canvas.drawString(x, height - top, prefix)
    year_start = x + stringWidth(prefix, 'Times-Roman', size)
    canvas.setFont(year_font, size)
    canvas.drawString(year_start, height - top, year)
    year_end = year_start + stringWidth(year, year_font, size)
    if suffix:
        canvas.setFont('Times-Roman', size)
        canvas.drawString(year_end, height - top, suffix)
        canvas.setLineWidth(0.4)
        canvas.line(year_start, height - top - 1.2, year_end, height - top - 1.2)
    text(config['chairperson_name'], 350 if department else 365,
         746 if department else 791, 172 if department else 185, center=True, erase=True, font=formatting_font(config, 'name'))
    sworn_date = '________ day of __________ year _______'
    if approved_at:
        date = approved_at.astimezone(ZoneInfo('Asia/Manila')).date()
        sworn_date = f'{date.day} day of {date.strftime("%B")} year {date.year}'
    line = (f'SUBSCRIBED AND SWORN to me before this {sworn_date}, '
            'at USTP Oroquieta Campus, with the affiant'
            + (' exhibiting' if not department else ''))
    text(line, 36, 688.54 if department else 691.99, 539, size=9.5 if department else 9, erase=True)
    canvas.save()
    page.merge_page(PdfReader(io.BytesIO(overlay.getvalue())).pages[0])
    output = io.BytesIO()
    writer.write(output)
    return output.getvalue()


def issue_certificate(cur, application, approved_at=None):
    """Run inside initial approval's transaction; preserve the signed original."""
    app_id = application['id']
    cur.execute('SELECT application_id FROM candidate_certificate_issuances WHERE application_id = %s', [app_id])
    if cur.fetchone():
        return
    cur.execute('SELECT pdf_bytes FROM candidate_application_certificates WHERE application_id = %s', [app_id])
    archive = cur.fetchone()
    if archive is None:
        return  # Legacy filings without an archive remain reviewable.
    config = read_settings(cur, application.get('election_id'), form_kind(application.get('organization')))
    if config is None:
        raise ValueError('Save the academic year and chairperson in Certificate of Candidacy before approving this filing.')
    approved_at = approved_at or timezone.now()
    try:
        raw = decorate_pdf(bytes(archive[0]), config, approved_at)
    except Exception as exc:
        raise ValueError('Could not prepare the approved COC. Verify that the candidate used the current template.') from exc
    cur.execute('''INSERT INTO candidate_certificate_issuances
        (application_id, pdf_bytes, sha256, settings_snapshot, initial_approved_at)
        VALUES (%s, %s, %s, %s::jsonb, %s) ON CONFLICT (application_id) DO NOTHING''',
        [app_id, raw, hashlib.sha256(raw).hexdigest(), json.dumps(config), approved_at])


def template_response(request, election_id, kind):
    if kind not in {'usg', 'department'}:
        return JsonResponse({'ok': False, 'error': 'Template not found.'}, status=404)
    signature = None
    if getattr(request, 'method', 'GET') == 'POST':
        try:
            params = json.loads(request.body)
            if not isinstance(params, dict):
                raise ValueError('Invalid draft preview.')
            signature = decode_signature(params.get('chairperson_signature_base64'))
        except (ValueError, UnicodeDecodeError) as error:
            return JsonResponse({'ok': False, 'error': str(error)}, status=400)
    else:
        params = request.GET
    if getattr(request, 'method', 'GET') == 'POST' or params.get('draft') == '1':
        # Draft rendering is read-only and never updates settings or issued COCs.
        start = str(params.get('academic_year_start') or '').strip()
        end = str(params.get('academic_year_end') or '').strip()
        chair = str(params.get('chairperson_name') or '').strip()
        if len(chair) > 120 or any(ord(char) < 32 for char in chair):
            return JsonResponse({'ok': False, 'error': 'Use a chairperson name of up to 120 characters.'}, status=400)
        year = '____ - ____'
        if start or end:
            if not (start.isascii() and end.isascii() and start.isdigit() and end.isdigit()
                    and len(start) == len(end) == 4 and 1900 <= int(start) <= 2200
                    and int(end) == int(start) + 1):
                return JsonResponse({'ok': False, 'error': 'Enter two consecutive academic years.'}, status=400)
            year = f'{start} - {end}'
        try:
            formatting = formatting_flags(params, query=getattr(request, 'method', 'GET') != 'POST')
        except ValueError as error:
            return JsonResponse({'ok': False, 'error': str(error)}, status=400)
        config = {'academic_year': year, 'chairperson_name': chair, **formatting}
    else:
        with connection.cursor() as cur:
            config = read_settings(cur, election_id, kind)
        if config is None:
            return JsonResponse({'ok': False, 'error': 'Save the academic year and chairperson first.'}, status=409)
    filename = 'department_certificate_of_candidacy.pdf' if kind == 'department' else 'certificate_of_candidacy.pdf'
    source = Path(settings.BASE_DIR) / 'core' / 'forms' / filename
    raw = decorate_pdf(source.read_bytes(), config)
    if signature:
        raw = overlay_signature(raw, signature)
    response = HttpResponse(raw, content_type='application/pdf')
    response['Content-Disposition'] = f'inline; filename="{kind}_certificate_of_candidacy.pdf"'
    response['Cache-Control'] = 'private, no-store'
    response['X-Content-Type-Options'] = 'nosniff'
    return response
