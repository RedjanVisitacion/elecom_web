"""Session-bound browser push for the administrative alert feed."""
import json
import logging

from django.conf import settings
from django.contrib.sessions.models import Session
from django.db import connection, transaction
from django.http import HttpResponse, JsonResponse
from django.middleware.csrf import get_token
from django.utils import timezone
from django.utils.crypto import constant_time_compare, salted_hmac
from django.views.decorators.http import require_http_methods

logger = logging.getLogger(__name__)
PUBLIC_FIELDS = ('apiKey', 'authDomain', 'projectId', 'messagingSenderId', 'appId')


def public_config():
    raw = getattr(settings, 'ADMIN_FIREBASE_WEB_CONFIG', '{}')
    try:
        config = json.loads(raw) if isinstance(raw, str) else raw
        return {key: str(config[key]) for key in PUBLIC_FIELDS if config.get(key)}
    except (ValueError, TypeError, AttributeError):
        return {}


def ensure_tables():
    with connection.cursor() as cur:
        cur.execute('''CREATE TABLE IF NOT EXISTS admin_browser_push (
            token TEXT PRIMARY KEY, session_key VARCHAR(64) NOT NULL,
            seen_ids TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )''')


def _json(data, status=200):
    response = JsonResponse(data, status=status)
    response['Cache-Control'] = 'private, no-store'
    return response


@require_http_methods(['GET', 'POST', 'DELETE'])
def browser_push_api(request):
    from .views import _require_admin, collect_admin_alerts
    forbidden = _require_admin(request)
    if forbidden is not None:
        return forbidden
    if request.method == 'GET':
        config = public_config()
        vapid = getattr(settings, 'ADMIN_FIREBASE_VAPID_KEY', '')
        account = salted_hmac('admin-alert-account', str(request.session.get('student_id', ''))).hexdigest()
        return _json({'ok': True, 'configured': all(config.get(k) for k in ('apiKey', 'projectId', 'messagingSenderId', 'appId')) and bool(vapid),
                      'config': config, 'vapidKey': vapid, 'csrfToken': get_token(request), 'account': account})
    try:
        token = json.loads(request.body).get('token')
        if not isinstance(token, str) or not token.strip() or len(token) > 4096:
            raise ValueError()
        token = token.strip()
    except (ValueError, AttributeError, UnicodeDecodeError):
        return _json({'ok': False, 'error': 'A valid browser token is required.'}, 400)
    if not request.session.session_key:
        request.session.save()
    ensure_tables()
    if request.method == 'DELETE':
        with connection.cursor() as cur:
            cur.execute('DELETE FROM admin_browser_push WHERE token = %s AND session_key = %s', [token, request.session.session_key])
    else:
        # First subscription starts at the current feed, without replaying old alerts.
        baseline = [str(item['id']) for item in collect_admin_alerts(50)]
        with connection.cursor() as cur:
            cur.execute('''INSERT INTO admin_browser_push (token, session_key, seen_ids)
                VALUES (%s, %s, %s) ON CONFLICT (token) DO UPDATE SET
                seen_ids = CASE WHEN admin_browser_push.session_key = EXCLUDED.session_key
                                THEN admin_browser_push.seen_ids ELSE EXCLUDED.seen_ids END,
                session_key = EXCLUDED.session_key, updated_at = NOW()''',
                [token, request.session.session_key, baseline])
    return _json({'ok': True})


def live_admin_session(session_key):
    from .account_sessions import password_stamp
    session = Session.objects.filter(session_key=session_key, expire_date__gt=timezone.now()).first()
    data = session.get_decoded() if session else {}
    if data.get('role') != 'admin' or not data.get('student_id'):
        return False
    identity = str(data['student_id'])
    with connection.cursor() as cur:
        cur.execute('''SELECT role, password_hash FROM users WHERE student_id::text = %s OR id::text = %s
                       ORDER BY CASE WHEN student_id::text = %s THEN 0 ELSE 1 END, id DESC LIMIT 1''', [identity, identity, identity])
        row = cur.fetchone()
    return bool(row and str(row[0]).lower() == 'admin' and row[1] and
                constant_time_compare(str(data.get('_elecom_auth_stamp', '')), password_stamp(row[1])))


def unseen_alerts(alerts, seen_ids):
    seen = set(seen_ids)
    return [item for item in alerts if str(item['id']) not in seen]


def deliver_admin_browser_pushes():
    from .candidate_push import _messaging
    from .views import collect_admin_alerts
    ensure_tables()
    with connection.cursor() as cur:
        cur.execute('SELECT token FROM admin_browser_push')
        tokens = [row[0] for row in cur.fetchall()]
    if not tokens:
        return 0
    alerts = collect_admin_alerts(50)
    current_ids = [str(item['id']) for item in alerts]
    sent = 0
    for token in tokens:
        try:
            with transaction.atomic():
                with connection.cursor() as cur:
                    cur.execute('SELECT session_key, seen_ids FROM admin_browser_push WHERE token = %s FOR UPDATE SKIP LOCKED', [token])
                    row = cur.fetchone()
                    if not row:
                        continue
                    if not live_admin_session(row[0]):
                        cur.execute('DELETE FROM admin_browser_push WHERE token = %s', [token])
                        continue
                    pending = unseen_alerts(alerts, row[1])
                    if pending:
                        messaging = _messaging()
                        # One generic alert per batch. Never put names, student IDs,
                        # security logs or opaque page/session tokens on a lock screen.
                        message = messaging.Message(token=token,
                            data={'type': 'admin_alerts', 'alert_id': str(pending[0]['id'])},
                            notification=messaging.Notification(title='ELECOM Admin', body='New administrative alerts. Sign in to review them.'),
                            webpush=messaging.WebpushConfig(headers={'Urgency': 'high', 'TTL': '3600'},
                                notification=messaging.WebpushNotification(tag='elecom-admin-alerts')))
                        messaging.send(message)
                        sent += 1
                    cur.execute('UPDATE admin_browser_push SET seen_ids = %s WHERE token = %s', [list(dict.fromkeys(list(row[1]) + current_ids))[-500:], token])
        except Exception as error:
            if type(error).__name__ in {'UnregisteredError', 'SenderIdMismatchError'}:
                with connection.cursor() as cur:
                    cur.execute('DELETE FROM admin_browser_push WHERE token = %s', [token])
            else:
                logger.warning('Admin browser push deferred (%s)', type(error).__name__)
    return sent


@require_http_methods(['GET'])
def browser_push_worker(request):
    config = public_config()
    script = '''self.addEventListener('notificationclick', event => {
      event.notification.close();
      event.waitUntil(clients.openWindow('/login/'));
    });
    importScripts('https://www.gstatic.com/firebasejs/13.0.0/firebase-app-compat.js');
    importScripts('https://www.gstatic.com/firebasejs/13.0.0/firebase-messaging-compat.js');
    firebase.initializeApp(CONFIG);
    firebase.messaging();
    '''.replace('CONFIG', json.dumps(config))
    response = HttpResponse(script, content_type='application/javascript')
    response['Cache-Control'] = 'no-cache'
    response['Service-Worker-Allowed'] = '/'
    return response
