"""Read-only user image gallery under the existing developer password gate."""
import logging
from urllib.parse import urlsplit

from django.db import connection
from django.http import JsonResponse
from django.views.decorators.http import require_GET

from .developer_options import _developer_admin

logger = logging.getLogger(__name__)
SOURCES = (
    ('users', 'photo_url', 'Profile photo', None, None),
    ('face_enrollments', 'face_image_url', 'Face enrollment', 'enrolled_at', 'enrollment_status'),
    ('candidate_applications', 'photo_url', 'Candidate filing photo', 'created_at', 'status'),
    ('candidate_applications', 'party_logo_url', 'Party logo upload', 'created_at', 'status'),
    ('candidates_registration', 'party_logo_url', 'Registered party logo', None, None),
    ('candidate_applications', 'requirements_photo_url', 'Follow-up photo', 'updated_at', 'status'),
    ('candidates_registration', 'photo_url', 'Registered candidate photo', None, None),
)


def image_url(value):
    value = str(value or '').strip()
    try:
        parsed = urlsplit(value)
        if parsed.scheme not in {'https', 'http'} or not parsed.hostname or parsed.username or parsed.password:
            return None
    except ValueError:
        return None
    return value


@require_GET
def developer_gallery_api(request):
    denied = _developer_admin(request)
    if denied is not None:
        return denied
    try:
        page = int(request.GET.get('page', '1'))
        if not 1 <= page <= 100000:
            raise ValueError
    except (ValueError, TypeError):
        return JsonResponse({'ok': False, 'error': 'Invalid page.'}, status=400)
    query = str(request.GET.get('q') or '').strip()[:150]
    like = '%' + query.replace('\\', '\\\\').replace('%', '\\%').replace('_', '\\_') + '%'
    try:
        with connection.cursor() as cur:
            cur.execute('''SELECT table_name, column_name FROM information_schema.columns
                           WHERE table_schema = current_schema() AND table_name = ANY(%s)''',
                        [list({source[0] for source in SOURCES}) + ['student']])
            columns = {}
            for table, column in cur.fetchall():
                columns.setdefault(table, set()).add(column)
            selects = []
            for table, field, label, date, status in SOURCES:
                available = columns.get(table, set())
                if not {'student_id', field}.issubset(available):
                    continue
                date_sql = f'{date}::text' if date in available else 'NULL::text'
                status_sql = f'{status}::text' if status in available else 'NULL::text'
                # Identifiers and labels come exclusively from the fixed SOURCES allowlist.
                selects.append(f"SELECT student_id::text AS student_id, {field}::text AS url, '{label}'::text AS kind, {date_sql} AS uploaded_at, {status_sql} AS status FROM {table} WHERE NULLIF(TRIM({field}), '') IS NOT NULL")
            if not selects:
                return JsonResponse({'ok': True, 'users': [], 'page': page, 'has_more': False})
            uploads = ' UNION ALL '.join(selects)
            has_students = {'id_number', 'first_name', 'middle_name', 'last_name'}.issubset(columns.get('student', set()))
            names = [f"COALESCE(NULLIF(u.{field}, ''), " + (f"s.{field}, " if has_students else '') + "'')" for field in ['first_name', 'middle_name', 'last_name']]
            join = "LEFT JOIN student s ON s.id_number::text = u.student_id::text" if has_students else ''
            cur.execute(f'''WITH uploads AS ({uploads})
                SELECT u.id, u.student_id, {', '.join(names)} FROM users u {join}
                WHERE EXISTS (SELECT 1 FROM uploads p WHERE p.student_id = u.student_id::text)
                  AND CONCAT_WS(' ', u.student_id, {', '.join(names)}) ILIKE %s
                ORDER BY LOWER(CONCAT_WS(' ', {', '.join(names)})), u.student_id, u.id
                LIMIT 21 OFFSET %s''', [like, (page - 1) * 20])
            rows = cur.fetchall()
            users = [{'id': row[0], 'student_id': str(row[1]),
                      'name': ' '.join(str(part) for part in row[2:] if part).strip() or str(row[1]),
                      'images': []} for row in rows[:20]]
            if users:
                cur.execute(f'''WITH uploads AS ({uploads}) SELECT student_id, url, kind, uploaded_at, status
                    FROM uploads WHERE student_id = ANY(%s) ORDER BY student_id, uploaded_at DESC NULLS LAST, kind''',
                            [[user['student_id'] for user in users]])
                by_student = {user['student_id']: user for user in users}
                seen = set()
                for student_id, url, kind, uploaded_at, status in cur.fetchall():
                    url = image_url(url)
                    key = (student_id, url, kind)
                    if url and key not in seen:
                        seen.add(key)
                        by_student[student_id]['images'].append({'url': url, 'kind': kind, 'uploaded_at': uploaded_at, 'status': status})
        response = JsonResponse({'ok': True, 'users': users, 'page': page, 'has_more': len(rows) > 20})
        response['Cache-Control'] = 'private, no-store'
        return response
    except Exception:
        logger.exception('Developer image gallery could not load')
        return JsonResponse({'ok': False, 'error': 'Unable to load saved images. Please try again.'}, status=500)
