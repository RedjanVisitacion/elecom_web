"""Device visibility and revocation for ELECOM's custom database sessions."""
import ipaddress
import json
import logging
from datetime import datetime
from importlib import import_module

from django.conf import settings
from django.contrib.sessions.models import Session
from django.core.exceptions import ImproperlyConfigured
from django.http import JsonResponse
from django.middleware.csrf import get_token
from django.db import connection, transaction
from django.utils import timezone
from django.utils.crypto import constant_time_compare, salted_hmac
from django.views.decorators.http import require_http_methods

_STAMP = '_elecom_auth_stamp'
_DEVICE = '_elecom_device'
_PUSH = '_elecom_push_token'
logger = logging.getLogger(__name__)


def password_stamp(password_hash):
    return salted_hmac('elecom.password-session.v1', str(password_hash), algorithm='sha256').hexdigest()


def _opaque_id(key):
    return salted_hmac('elecom.device-session.v1', key, algorithm='sha256').hexdigest()


def _device_name(request):
    ua = request.META.get('HTTP_USER_AGENT', '')[:1024]
    platform = next((label for token, label in (
        ('Android', 'Android'), ('iPhone', 'iPhone'), ('iPad', 'iPad'),
        ('Windows', 'Windows'), ('Macintosh', 'macOS'), ('Linux', 'Linux'),
        ('android', 'Android'), ('ios', 'iOS'), ('windows', 'Windows'),
    ) if token in ua), 'Unknown device')
    if 'ELECOM-Mobile' in ua:
        label = str(request.META.get('HTTP_X_ELECOM_DEVICE') or '').strip()[:80]
        return f'ELECOM Mobile - {label or platform}'
    browser = next((label for token, label in (
        ('Edg/', 'Edge'), ('OPR/', 'Opera'), ('Chrome/', 'Chrome'),
        ('Firefox/', 'Firefox'), ('Safari/', 'Safari'),
    ) if token in ua), 'Browser / older app')
    return f'{browser} - {platform}'


def _ip(request):
    peer = request.META.get('REMOTE_ADDR', '')
    try:
        # Only the local reverse proxy may supply a client-address header.
        if ipaddress.ip_address(peer).is_loopback:
            peer = request.META.get('HTTP_X_REAL_IP') or request.META.get('HTTP_X_FORWARDED_FOR', '').split(',')[-1].strip() or peer
        return str(ipaddress.ip_address(peer))
    except ValueError:
        return ''


def _metadata(request, signed_in_at=None):
    return {'device_name': _device_name(request), 'ip_address': _ip(request),
            'signed_in_at': signed_in_at, 'last_active_at': timezone.now().isoformat()}


def start_account_session(request, identity, role, password_hash):
    # Rotate by flushing, so privileges from a previously signed-in account do not survive.
    request.session.flush()
    request.session['student_id'] = str(identity)
    request.session['role'] = role
    request.session[_STAMP] = password_stamp(password_hash)
    request.session[_DEVICE] = _metadata(request, timezone.now().isoformat())


class AccountSessionMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        identity = str(request.session.get('student_id') or '').strip()
        if identity:
            with connection.cursor() as cur:
                cur.execute('''SELECT password_hash FROM users
                    WHERE student_id::text = %s OR id::text = %s
                    ORDER BY CASE WHEN student_id::text = %s THEN 0 ELSE 1 END, id DESC LIMIT 1''',
                    [identity, identity, identity])
                row = cur.fetchone()
            expected = password_stamp(row[0]) if row and row[0] else ''
            actual = request.session.get(_STAMP)
            if not expected or (actual and not constant_time_compare(str(actual), expected)):
                request.session.flush()
                if request.path.startswith('/api/'):
                    return _json({'ok': False, 'error': 'Your session has ended. Please sign in again.'}, 401)
            else:
                if not actual:
                    request.session[_STAMP] = expected
                previous = request.session.get(_DEVICE) or {}
                if not isinstance(previous, dict):
                    previous = {}
                try:
                    last = datetime.fromisoformat(previous.get('last_active_at', ''))
                    due = (timezone.now() - last).total_seconds() >= 60
                except (ValueError, TypeError):
                    due = True
                if due:
                    request.session[_DEVICE] = _metadata(request, previous.get('signed_in_at'))
        return self.get_response(request)


def _owned_sessions(identity):
    if settings.SESSION_ENGINE not in ('django.contrib.sessions.backends.db', 'django.contrib.sessions.backends.cached_db'):
        raise ImproperlyConfigured('Account device management requires database-backed Django sessions.')
    for session in Session.objects.filter(expire_date__gt=timezone.now()).iterator(chunk_size=200):
        data = session.get_decoded()
        if str(data.get('student_id') or '') == str(identity):
            yield session, data


def _delete(key):
    import_module(settings.SESSION_ENGINE).SessionStore(session_key=key).delete()


def _remove_push_tokens(identity, tokens=None):
    # Optional push storage must not prevent security logout on a fresh database.
    try:
        with transaction.atomic():
            if 'mobile_push_tokens' not in connection.introspection.table_names():
                return
            with connection.cursor() as cur:
                if tokens is None:
                    cur.execute('DELETE FROM mobile_push_tokens WHERE student_id = %s', [str(identity)])
                else:
                    for token in tokens:
                        cur.execute('DELETE FROM mobile_push_tokens WHERE student_id = %s AND token = %s', [str(identity), token])
    except Exception:
        logger.exception('Unable to unlink revoked account push registrations')


def _unlink_device_push(identity, key, data):
    token = data.get(_PUSH)
    if token and not any(other.session_key != key and details.get(_PUSH) == token
                         for other, details in _owned_sessions(identity)):
        _remove_push_tokens(identity, [token])


def end_current_session(request):
    identity = str(request.session.get('student_id') or '')
    if identity:
        _unlink_device_push(identity, request.session.session_key, request.session)
    request.session.flush()


def revoke_account_sessions(identity, request=None):
    count = 0
    _remove_push_tokens(identity)
    for session, _ in _owned_sessions(identity):
        _delete(session.session_key)
        count += 1
    if request is not None and str(request.session.get('student_id') or '') == str(identity):
        request.session.flush()
    return count


def _json(data, status=200):
    response = JsonResponse(data, status=status)
    response['Cache-Control'] = 'no-store'
    return response


@require_http_methods(['GET'])
def account_session_status_api(request):
    if not request.session.get('student_id'):
        return _json({'ok': False, 'error': 'Unauthorized.'}, 401)
    get_token(request)
    return _json({'ok': True})


@require_http_methods(['GET'])
def account_sessions_api(request):
    identity = request.session.get('student_id')
    if not identity:
        return _json({'ok': False, 'error': 'Unauthorized.'}, 401)
    get_token(request)
    records = []
    for session, data in _owned_sessions(identity):
        current = session.session_key == request.session.session_key
        details = (request.session if current else data).get(_DEVICE) or {}
        records.append({'id': _opaque_id(session.session_key), 'is_current': current,
            'device_name': details.get('device_name') or 'Older session - device details unavailable',
            'ip_address': details.get('ip_address') or '',
            'signed_in_at': details.get('signed_in_at'),
            'last_active_at': details.get('last_active_at')})
    records.sort(key=lambda r: (r['is_current'], r['last_active_at'] or ''), reverse=True)
    return _json({'ok': True, 'sessions': records})


# Intentionally CSRF-protected. Mobile gets the cookie from the GET list/status API.
@require_http_methods(['POST'])
def account_sessions_logout_api(request):
    identity = request.session.get('student_id')
    if not identity:
        return _json({'ok': False, 'error': 'Unauthorized.'}, 401)
    try:
        data = json.loads(request.body)
    except (ValueError, TypeError):
        return _json({'ok': False, 'error': 'Invalid request.'}, 400)
    if not isinstance(data, dict):
        return _json({'ok': False, 'error': 'Invalid request.'}, 400)
    if data.get('all') is True and not data.get('session_id'):
        count = revoke_account_sessions(identity, request)
        return _json({'ok': True, 'current_session_ended': True, 'revoked_count': count})
    target = data.get('session_id')
    if not isinstance(target, str) or len(target) != 64 or data.get('all'):
        return _json({'ok': False, 'error': 'Select a device to log out.'}, 400)
    for session, details in _owned_sessions(identity):
        if constant_time_compare(_opaque_id(session.session_key), target):
            current = session.session_key == request.session.session_key
            _unlink_device_push(identity, session.session_key, details)
            if current:
                request.session.flush()
            else:
                _delete(session.session_key)
            return _json({'ok': True, 'current_session_ended': current})
    return _json({'ok': False, 'error': 'Session not found or already ended.'}, 404)
