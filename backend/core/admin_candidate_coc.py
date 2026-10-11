"""Browser-completed admin COCs, using the same templates and positions as mobile."""
import base64
import hashlib
import io
from datetime import date
from zoneinfo import ZoneInfo
from django.utils import timezone
from pathlib import Path
from django.conf import settings


def build_certificate(payload):
    from PIL import Image, ImageOps
    from pypdf import PdfReader, PdfWriter
    from reportlab.pdfgen.canvas import Canvas
    from reportlab.pdfbase.pdfmetrics import stringWidth
    from reportlab.lib.utils import ImageReader
    from .coc_management import form_kind
    from .coc_chairperson_signatures import decode_signature
    fields = {key: str(value or '').strip() for key, value in payload.items()
              if isinstance(value, (str, int)) and key not in ('photo_base64', 'signature_base64', 'party_code')}
    for key in ('student_id','first_name','last_name','organization','position','program','year_section',
                'gender','date_of_birth','contact_number','email','address'):
        if not fields.get(key):
            raise ValueError(f'{key.replace("_", " ").title()} is required for the COC.')
    if fields['organization'].upper() not in {'USG','SITE','PAFE','AFPRO','AFPROTECHS'}:
        raise ValueError('Select a supported organization.')
    if fields.get('candidate_type') not in {'Independent','Political Party'}:
        raise ValueError('Select Independent or Political Party.')
    if fields.get('candidate_type') == 'Political Party' and not fields.get('party_name'):
        raise ValueError('Party name is required.')
    if any(len(v) > (10000 if k == 'platform' else 255) for k,v in fields.items()):
        raise ValueError('A COC field is too long.')
    try:
        birth = date.fromisoformat(fields['date_of_birth'])
        today = timezone.now().astimezone(ZoneInfo('Asia/Manila')).date()
        if birth > today:
            raise ValueError()
        fields['age'] = str(today.year-birth.year-((today.month,today.day)<(birth.month,birth.day)))
    except ValueError:
        raise ValueError('Enter a valid date of birth.')
    try:
        signature = decode_signature(payload.get('signature_base64'))
        if not signature:
            raise ValueError()
    except ValueError:
        raise ValueError('The candidate must draw a visible signature.')
    encoded = str(payload.get('photo_base64') or '')
    if len(encoded) > 12 * 1024 * 1024:
        raise ValueError('Candidate photo must be at most 8 MB.')
    try:
        photo = base64.b64decode(encoded, validate=True)
        if len(photo) > 8 * 1024 * 1024:
            raise ValueError()
        image = Image.open(io.BytesIO(photo))
        if image.format not in ('PNG','JPEG','WEBP') or image.width * image.height > 25000000:
            raise ValueError()
        image = ImageOps.fit(image.convert('RGB'), (384,384))
    except Exception:
        raise ValueError('Select a valid candidate photo for the COC.')
    department = form_kind(fields['organization']) == 'department'
    height = 792 if department else 1008
    filename = 'department_certificate_of_candidacy.pdf' if department else 'certificate_of_candidacy.pdf'
    reader = PdfReader(Path(settings.BASE_DIR, 'core', 'forms', filename))
    overlay = io.BytesIO()
    canvas = Canvas(overlay, pagesize=(612,height))
    def text(value,x,top,width):
        value = str(value or '')
        size = min(10, 10*width/max(stringWidth(value,'Times-Roman',10),1))
        canvas.setFont('Times-Roman',size)
        canvas.drawString(x,height-top-9,value)
    canvas.setFillColorRGB(1,1,1)
    canvas.rect(433,height-239,140,130,fill=1,stroke=0)
    canvas.drawImage(ImageReader(image),439,height-238,128,128)
    canvas.setFillColorRGB(0,0,0)
    text(fields['student_id'],500,264 if department else 258,75)
    text(' '.join(fields[k] for k in ('first_name','middle_name','last_name') if fields.get(k)),180,278 if department else 271,393)
    text(fields.get('curriculum_program') or fields['program'],180,292 if department else 284,393)
    text(fields.get('major'),180,306 if department else 297,393)
    for key,x,width,dept_top,usg_top in [('gender',112,119,348,336),('date_of_birth',316,146,348,336),('age',502,72,348,336),('contact_number',112,119,364,352),('email',316,258,364,352),('address',112,463,378,365)]:
        text(fields.get(key),x,dept_top if department else usg_top,width)
    for i in range(3):
        for suffix,x,width in [('organization',32,258),('years',300,130),('position',441,130)]:
            text(fields.get(f'affiliation_{i}_{suffix}'),x,(434+i*14.16) if department else (419+i*13.2),width)
    text('Independent' if fields.get('candidate_type')=='Independent' else fields.get('party_name'),163,518 if department else 497,412)
    text(fields['position'],163,532 if department else 510,412)
    text(fields['position'],214 if department else 154,592 if department else 568,64 if department else 224)
    canvas.drawImage(ImageReader(io.BytesIO(signature)),221,height-(661 if department else 643),170,18 if department else 29,preserveAspectRatio=True,anchor='c',mask='auto')
    canvas.save()
    writer = PdfWriter()
    writer.add_page(reader.pages[0])
    writer.pages[0].merge_page(PdfReader(io.BytesIO(overlay.getvalue())).pages[0])
    output = io.BytesIO(); writer.write(output)
    raw = output.getvalue()
    return {'pdf':raw,'signature':signature,'fields':fields,'sha256':hashlib.sha256(raw).hexdigest()}


def archive_direct_registration(cur, payload, election_id, reviewer, certificate):
    from .candidate_certificates import save_certificate
    from .coc_management import issue_certificate
    from .coc_chairperson_signatures import finalize_certificate
    cur.execute('SELECT id FROM candidate_applications WHERE election_id=%s AND student_id=%s AND organization=%s AND position=%s',
                [election_id,payload['student_id'],payload['organization'],payload['position']])
    if cur.fetchone():
        raise ValueError('This student already has a filing for this position. Review that filing instead.')
    keys = ['student_id','first_name','middle_name','last_name','organization','position','program','year_section',
            'platform','candidate_type','party_name','party_code_hash','party_code','photo_url','party_logo_url']
    cur.execute('INSERT INTO candidate_applications ('+', '.join(keys)+", election_id, status, reviewed_by, reviewed_at) VALUES ("+', '.join(['%s']*len(keys))+", %s, 'approved', %s, CURRENT_TIMESTAMP) RETURNING id",
                [payload.get(k) for k in keys]+[election_id,reviewer])
    application = {'id':cur.fetchone()[0],'election_id':election_id,'organization':payload['organization']}
    save_certificate(cur,application['id'],payload['student_id'],certificate,template_version='admin-browser-coc-v1')
    issue_certificate(cur,application)
    finalize_certificate(cur,application)
    return application['id']
