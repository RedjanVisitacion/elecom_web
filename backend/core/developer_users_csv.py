"""Developer-gated CSV account transfer; roles and credentials are never imported."""
import csv
import io
import logging

from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.db import connection, transaction
from django.http import HttpResponse, JsonResponse
from django.views.decorators.http import require_http_methods

from .developer_options import _developer_admin

FIELDS = ['student_id', 'first_name', 'middle_name', 'last_name', 'email',
          'course', 'year', 'section', 'phone_number', 'role']
LIMITS = [64, 128, 128, 128, 255, 128, 5, 50, 32, 32]


def safe_cell(value):
    text = str(value if value is not None else '')
    return "'" + text if text.lstrip().startswith(('=', '+', '-', '@')) else text


def parse_csv(upload):
    if not upload or not upload.name.lower().endswith('.csv'):
        raise ValueError('Choose a CSV file.')
    content = upload.read(2 * 1024 * 1024 + 1)
    if len(content) > 2 * 1024 * 1024:
        raise ValueError('CSV files must be at most 2 MB.')
    reader = csv.DictReader(io.StringIO(content.decode('utf-8-sig')), strict=True)
    required = set(FIELDS) - {'role', 'middle_name'}
    if not reader.fieldnames or len(set(reader.fieldnames)) != len(reader.fieldnames) or not required.issubset(reader.fieldnames) or set(reader.fieldnames) - set(FIELDS):
        raise ValueError('Use the template column headers. Role and middle_name are optional.')
    rows, seen = [], set()
    from .views import _validate_voter_payload
    for number, raw in enumerate(reader, 2):
        if None in raw or any(value is None for value in raw.values()):
            raise ValueError(f'Row {number}: column count does not match the header.')
        row = {key: str(raw.get(key) or '').strip() for key in FIELDS}
        for key in FIELDS:
            if row[key].startswith(("'=", "'+", "'-", "'@")):
                row[key] = row[key][1:]
        if not any(row.values()):
            continue
        if len(rows) >= 500:
            raise ValueError('Import at most 500 accounts at a time.')
        error = _validate_voter_payload(row)
        if error:
            raise ValueError(f'Row {number}: {error}')
        if any(len(row[key]) > limit or any(ord(c) < 32 for c in row[key]) for key, limit in zip(FIELDS, LIMITS)):
            raise ValueError(f'Row {number}: a field is too long or contains control characters.')
        if not 1 <= int(row['year']) <= 10:
            raise ValueError(f'Row {number}: year must be between 1 and 10.')
        try:
            validate_email(row['email'])
        except ValidationError:
            raise ValueError(f'Row {number}: enter a valid email address.') from None
        if row['student_id'] in seen:
            raise ValueError(f'Row {number}: duplicate Student ID in this file.')
        seen.add(row['student_id'])
        row['role'] = 'student'
        rows.append(row)
    if not rows:
        raise ValueError('The CSV contains no accounts.')
    return rows


@require_http_methods(['GET', 'POST'])
def developer_users_csv_api(request):
    denied = _developer_admin(request)
    if denied is not None:
        return denied
    if request.method == 'GET':
        response = HttpResponse(content_type='text/csv; charset=utf-8')
        response['Content-Disposition'] = 'attachment; filename="elecom-users.csv"'
        response['Cache-Control'] = 'private, no-store'
        response.write('\ufeff')
        writer = csv.writer(response)
        writer.writerow(FIELDS)
        if request.GET.get('template') != '1':
            with connection.cursor() as cur:
                cur.execute("""SELECT u.student_id,
                    COALESCE(NULLIF(u.first_name,''),s.first_name,''),
                    COALESCE(NULLIF(u.middle_name,''),s.middle_name,''),
                    COALESCE(NULLIF(u.last_name,''),s.last_name,''),
                    COALESCE(u.email,s.email,''), COALESCE(u.department,s.course,''),
                    COALESCE(u.year_level,s.year), COALESCE(u.section,s.section,''),
                    COALESCE(u.phone,s.phone_number,''), u.role
                    FROM users u LEFT JOIN student s ON s.id_number::text=u.student_id::text
                    ORDER BY u.id""")
                while True:
                    batch = cur.fetchmany(500)
                    if not batch:
                        break
                    writer.writerows([safe_cell(value) for value in row] for row in batch)
        return response
    try:
        rows = parse_csv(request.FILES.get('file'))
        from .views import _upsert_voter_row
        with transaction.atomic():
            with connection.cursor() as cur:
                cur.execute('LOCK TABLE users IN SHARE ROW EXCLUSIVE MODE')
                denied = _developer_admin(request)
                if denied is not None:
                    return denied
                cur.execute('SELECT student_id::text, COUNT(*) FROM users WHERE student_id::text = ANY(%s) GROUP BY student_id', [[row['student_id'] for row in rows]])
                existing = dict(cur.fetchall())
                if any(count > 1 for count in existing.values()):
                    raise ValueError('An imported Student ID matches multiple accounts. Resolve duplicates first.')
                if request.POST.get('preview') != '1':
                    for row in rows:
                        error = _upsert_voter_row(cur, row)
                        if error:
                            raise ValueError(error)
        response = JsonResponse({'ok': True, 'created': len(rows) - len(existing), 'updated': len(existing), 'preview': request.POST.get('preview') == '1'})
        response['Cache-Control'] = 'private, no-store'
        return response
    except (ValueError, UnicodeError, csv.Error) as error:
        return JsonResponse({'ok': False, 'error': str(error)}, status=400)
    except Exception:
        logging.getLogger(__name__).exception('User CSV import failed')
        return JsonResponse({'ok': False, 'error': 'Import failed. No accounts were changed.'}, status=500)
