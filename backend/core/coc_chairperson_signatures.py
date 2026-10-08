"""Private chairperson signature settings and final-approval COC editions."""
import base64
import binascii
import hashlib
import io
import json

from django.utils import timezone

MAX_SIGNATURE_BYTES = 1024 * 1024
MIGRATION_SQL = """
ALTER TABLE candidate_certificate_settings ADD COLUMN IF NOT EXISTS chairperson_signature_bytes BYTEA NULL;
CREATE TABLE IF NOT EXISTS candidate_certificate_finalizations (
    application_id INTEGER PRIMARY KEY REFERENCES candidate_applications(id) ON DELETE RESTRICT,
    pdf_bytes BYTEA NOT NULL,
    sha256 VARCHAR(64) NOT NULL,
    signature_bytes BYTEA NOT NULL,
    settings_snapshot JSONB NOT NULL,
    final_approved_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT final_coc_size CHECK (octet_length(pdf_bytes) BETWEEN 1 AND 8388608)
);
"""


def decode_signature(encoded):
    if not encoded:
        return None
    if not isinstance(encoded, str) or len(encoded) > 4 * ((MAX_SIGNATURE_BYTES + 2) // 3):
        raise ValueError('Use a PNG signature no larger than 1 MB.')
    try:
        raw = base64.b64decode(encoded, validate=True)
    except (ValueError, binascii.Error) as exc:
        raise ValueError('Invalid chairperson signature.') from exc
    if not raw.startswith(b'\x89PNG\r\n\x1a\n') or len(raw) > MAX_SIGNATURE_BYTES:
        raise ValueError('Use a PNG signature no larger than 1 MB.')
    from PIL import Image, ImageOps, ImageChops
    try:
        image = Image.open(io.BytesIO(raw))
        if image.format != 'PNG' or image.width * image.height > 4_000_000:
            raise ValueError
        image.load()
        image = image.convert('RGBA')
        # Remove a white background so the printed chairperson name remains visible.
        ink = ImageOps.grayscale(image).point(lambda value: 0 if value >= 245 else 255)
        image.putalpha(ImageChops.darker(image.getchannel('A'), ink))
        bounds = image.getbbox()
        if not bounds:
            raise ValueError('Draw or upload a visible signature.')
        image = image.crop(bounds)
        output = io.BytesIO(); image.save(output, format='PNG')
        if len(output.getvalue()) > MAX_SIGNATURE_BYTES:
            raise ValueError
        return output.getvalue()
    except ValueError as exc:
        raise ValueError(str(exc) or 'Use a valid PNG signature.') from exc
    except Exception as exc:
        raise ValueError('Use a valid PNG signature.') from exc


def read_signature(cur, election_id):
    cur.execute('''SELECT chairperson_signature_bytes, chairperson_name FROM candidate_certificate_settings
                   WHERE election_id = %s ORDER BY CASE WHEN form_kind = 'usg' THEN 0 ELSE 1 END LIMIT 1''',
                [election_id or 0])
    row = cur.fetchone()
    return (bytes(row[0]) if row and row[0] else None, row[1] if row else None)


def overlay_signature(raw, signature):
    from pypdf import PdfReader, PdfWriter
    from reportlab.pdfgen.canvas import Canvas
    from reportlab.lib.utils import ImageReader
    reader = PdfReader(io.BytesIO(raw))
    if len(reader.pages) != 1:
        raise ValueError('The COC must contain one page.')
    writer = PdfWriter(); writer.add_page(reader.pages[0]); page = writer.pages[0]
    height = float(page.mediabox.height)
    if abs(float(page.mediabox.width) - 612) > 1 or min(abs(height - 792), abs(height - 1008)) > 1:
        raise ValueError('Use the current COC template.')
    department = height < 900
    buffer = io.BytesIO(); canvas = Canvas(buffer, pagesize=(612, height))
    canvas.drawImage(ImageReader(io.BytesIO(signature)), 356 if department else 377.5,
                     height - (753 if department else 798), width=160, height=43,
                     preserveAspectRatio=True, anchor='c', mask='auto')
    canvas.save(); page.merge_page(PdfReader(io.BytesIO(buffer.getvalue())).pages[0])
    output = io.BytesIO(); writer.write(output)
    if len(output.getvalue()) > 8 * 1024 * 1024:
        raise ValueError('The signed COC exceeds 8 MB.')
    return output.getvalue()


def finalize_certificate(cur, application, approved_at=None):
    """Called only in final approval's transaction, preserving prior editions."""
    cur.execute('SELECT application_id FROM candidate_certificate_finalizations WHERE application_id = %s', [application['id']])
    if cur.fetchone():
        return
    cur.execute('''SELECT COALESCE(i.pdf_bytes, c.pdf_bytes), i.settings_snapshot
                   FROM candidate_application_certificates c
                   LEFT JOIN candidate_certificate_issuances i ON i.application_id = c.application_id
                   WHERE c.application_id = %s''', [application['id']])
    source = cur.fetchone()
    if source is None:
        return  # Older filings without a COC retain their existing review flow.
    signature, chair = read_signature(cur, application.get('election_id'))
    if not signature:
        raise ValueError('Save the ELECOM chairperson signature in COC Management before final approval.')
    snapshot = source[1]
    if isinstance(snapshot, str):
        snapshot = json.loads(snapshot)
    raw = bytes(source[0])
    if snapshot is None:
        from .coc_management import read_settings, decorate_pdf
        snapshot = read_settings(cur, application.get('election_id'), 'usg')
        raw = decorate_pdf(raw, snapshot)
    if snapshot['chairperson_name'] != chair:
        raise ValueError('The saved signature must match the chairperson named on this COC.')
    signed = overlay_signature(raw, signature)
    cur.execute('''INSERT INTO candidate_certificate_finalizations
        (application_id, pdf_bytes, sha256, signature_bytes, settings_snapshot, final_approved_at)
        VALUES (%s, %s, %s, %s, %s::jsonb, %s) ON CONFLICT (application_id) DO NOTHING''',
        [application['id'], signed, hashlib.sha256(signed).hexdigest(), signature,
         json.dumps(snapshot), approved_at or timezone.now()])
