"""Private COC archive. PDF and signature bytes are included in database backups."""
import base64
import binascii
import hashlib
import json
import logging

from django.db import connection, transaction
from django.http import HttpResponse, JsonResponse
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt

logger = logging.getLogger(__name__)
MAX_PDF_BYTES = 8 * 1024 * 1024
MAX_SIGNATURE_BYTES = 1024 * 1024
SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS candidate_application_certificates (
    application_id INTEGER PRIMARY KEY REFERENCES candidate_applications(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
    pdf_bytes BYTEA NOT NULL,
    signature_bytes BYTEA NOT NULL,
    filing_fields JSONB NOT NULL,
    sha256 VARCHAR(64) NOT NULL,
    template_version VARCHAR(64) NOT NULL DEFAULT 'mobile-coc-v1',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT candidate_coc_size CHECK (octet_length(pdf_bytes) BETWEEN 1 AND 8388608)
);
"""


def ensure_certificate_table():
    with connection.cursor() as cur:
        cur.execute(SCHEMA_SQL)


def read_certificate_upload(request, require_signature=True):
    upload = request.FILES.get('certificate_pdf')
    if upload is None:
        # Keep older clients working. New clients require archival acknowledgement.
        return None
    raw = upload.read(MAX_PDF_BYTES + 1)
    if not raw.startswith(b'%PDF-') or b'%%EOF' not in raw[-1024:] or len(raw) > MAX_PDF_BYTES:
        raise ValueError('Certificate must be a valid PDF no larger than 8 MB.')
    encoded = str(request.POST.get('signature_base64') or '')
    if len(encoded) > 4 * ((MAX_SIGNATURE_BYTES + 2) // 3):
        raise ValueError('Signature must be no larger than 1 MB.')
    try:
        signature = base64.b64decode(encoded, validate=True)
    except (ValueError, binascii.Error) as exc:
        raise ValueError('Invalid candidate signature.') from exc
    if (require_signature or signature) and (
        not signature.startswith(b'\x89PNG\r\n\x1a\n') or len(signature) > MAX_SIGNATURE_BYTES
    ):
        raise ValueError('A PNG candidate signature is required.')
    keys = [
        'student_id', 'first_name', 'middle_name', 'last_name', 'organization',
        'position', 'program', 'year_section', 'platform', 'candidate_type',
        'party_name', 'curriculum_program', 'major', 'gender', 'date_of_birth',
        'age', 'contact_number', 'email', 'address', 'academic_year', 'chairperson_name',
        *[f'affiliation_{i}_{suffix}' for i in range(3)
          for suffix in ('organization', 'years', 'position')],
    ]
    fields = {key: str(request.POST.get(key) or '').strip() for key in keys}
    for key, value in fields.items():
        limit = 10000 if key == 'platform' else 200 if key == 'address' else 255
        if len(value) > limit:
            raise ValueError(f'{key.replace("_", " ")} is too long.')
    return {'pdf': raw, 'signature': signature, 'fields': fields,
            'sha256': hashlib.sha256(raw).hexdigest()}


def save_certificate(cur, application_id, student_id, certificate, template_version='mobile-coc-v1'):
    if certificate is None:
        return False
    fields = {**certificate['fields'], 'student_id': student_id}
    cur.execute("""
        INSERT INTO candidate_application_certificates
            (application_id, pdf_bytes, signature_bytes, filing_fields, sha256, template_version)
        VALUES (%s, %s, %s, %s::jsonb, %s, %s)
        ON CONFLICT (application_id) DO NOTHING
    """, [application_id, certificate['pdf'], certificate['signature'],
          json.dumps(fields), certificate['sha256'], template_version])
    return True


def certificate_summary(application_id):
    with connection.cursor() as cur:
        cur.execute('''SELECT COALESCE(i.sha256, c.sha256) FROM candidate_application_certificates c
                       LEFT JOIN candidate_certificate_issuances i ON i.application_id = c.application_id
                       WHERE c.application_id = %s''', [application_id])
        row = cur.fetchone()
    return {
        'certificate_available': bool(row),
        'certificate_sha256': row[0] if row else None,
    }


@csrf_exempt
@require_http_methods(['GET', 'POST'])
def candidate_certificate_api(request, application_id):
    student_id = str(request.session.get('student_id') or '').strip()
    if not student_id:
        return JsonResponse({'ok': False, 'error': 'Unauthorized.'}, status=401)
    try:
        # Roles come from the authenticated session, matching existing APIs.
        is_admin = str(request.session.get('role') or '').lower() == 'admin'
        if request.method == 'POST':
            # Backfill a previously device-only PDF. Archives are immutable.
            with transaction.atomic(), connection.cursor() as cur:
                cur.execute('SELECT student_id FROM candidate_applications WHERE id = %s FOR UPDATE',
                            [application_id])
                owner = cur.fetchone()
                if owner is None or str(owner[0]) != student_id:
                    return JsonResponse({'ok': False, 'error': 'Application not found.'}, status=404)
                cur.execute('SELECT sha256 FROM candidate_application_certificates WHERE application_id = %s',
                            [application_id])
                existing = cur.fetchone()
                if existing:
                    return JsonResponse({'ok': True, 'certificate_available': True,
                                         'certificate_sha256': existing[0]})
                certificate = read_certificate_upload(request, require_signature=False)
                if certificate is None:
                    raise ValueError('Certificate PDF is required.')
                save_certificate(cur, application_id, student_id, certificate, 'legacy-device-copy')
            return JsonResponse({'ok': True, 'certificate_available': True,
                                 'certificate_sha256': certificate['sha256']})
        with connection.cursor() as cur:
            cur.execute("""
                SELECT COALESCE(i.pdf_bytes, c.pdf_bytes), COALESCE(i.sha256, c.sha256)
                FROM candidate_application_certificates c
                JOIN candidate_applications a ON a.id = c.application_id
                LEFT JOIN candidate_certificate_issuances i ON i.application_id = c.application_id
                WHERE a.id = %s AND (a.student_id = %s OR %s)
            """, [application_id, student_id, is_admin])
            row = cur.fetchone()
        if row is None:
            return JsonResponse({'ok': False, 'error': 'Certificate not found.'}, status=404)
        response = HttpResponse(bytes(row[0]), content_type='application/pdf')
        response['Content-Disposition'] = f'inline; filename="certificate_of_candidacy_{application_id}.pdf"'
        response['Cache-Control'] = 'private, no-store'
        response['X-Content-Type-Options'] = 'nosniff'
        response['X-Certificate-SHA256'] = row[1]
        return response
    except ValueError as exc:
        return JsonResponse({'ok': False, 'error': str(exc)}, status=400)
    except Exception:
        logger.exception('Candidate certificate download failed')
        return JsonResponse({'ok': False, 'error': 'Could not load the certificate.'}, status=500)
