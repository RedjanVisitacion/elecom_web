# Account sessions and device logout

The mobile app now offers Settings -> Where you're logged in. It lists the account's active Django sessions, marks the current device, and supports logging out one device or all devices (including the current one). Password change and forgot-password reset revoke all sessions for that account.

## Deployment

Deploy the backend before distributing the new mobile APK. Both checkouts contain changes:

- Backend: G:\elecom_web\backend
- Mobile: G:\elecom_mobile
- Production backend: /var/www/elecom/backend

Commit and push the backend changes, then run on the server, one command at a time:

```bash
cd /var/www/elecom
git pull origin main
```

The installed post-merge deployment hook should restart Gunicorn and report its status. If that hook is unavailable, restart Gunicorn and check it explicitly. No new database migration is required; the existing database-backed Django sessions table is used. Database and cached-database session engines are supported; signed-cookie-only sessions are not supported by these revocation APIs.

Install the newly built mobile APK. Previously released APKs remain blocked by server-side revocation, but they do not have the new device-management screen or global return-to-login behavior.

## Behavior and limits

- Successful password change ends every session, including the caller, and saves an account notification on the backend. The app must not post a notification using the now-revoked session.
- Login flushes the previous session before creating the new identity and stores an HMAC of the current password hash. Middleware checks that stamp on authenticated requests, including for requests racing with a password change. Password hashes and bearer session cookies are never returned by the device-list API.
- Device selection uses a separate HMAC identifier and is always limited to the authenticated account. Logout mutations require CSRF. The app obtains the CSRF cookie through the GET session APIs and sends the matching header and same-origin referrer.
- New Android clients report manufacturer/model through an Android Build channel; no phone identifiers or additional device permissions are collected. Browser/platform labels are inferred from the user agent. These labels help recognition and are not proof of physical device identity.
- Session metadata stores sign-in time (for new logins), last activity, and the reported IP. Older sessions remain listed, with unavailable details clearly marked. They gain metadata as they next make authenticated requests; historical login times cannot be reconstructed.
- Client-address headers are used only behind a loopback reverse proxy. The rightmost forwarded address is used if X-Real-IP is unavailable. Other direct peers cannot supply trusted forwarding headers. IP addresses are not an exact geographic location.
- Revocation denies subsequent server requests; it does not cancel actions already in flight. Updated apps check on resume, every 30 seconds while active, and on any API 401 response. Offline clients return to login after their next online check.
- Revocation unlinks the account's push tokens for all-device logout/password changes. Per-device logout unlinks tokens recorded on that session, while preserving tokens shared by another active session on the same installation. Older sessions may not yet have a push-token association. Already delivered/queued notifications cannot be recalled.
- Regular logout now calls the server as well as clearing local state. Local logout remains available offline. The HTTP client never sends ELECOM session/CSRF cookies or device metadata to third-party upload origins and ignores stale unauthorized responses from an older login.
- Device listing and bulk revocation decode active session rows in bounded chunks. This avoids a schema migration but is a scan of active sessions; large deployments may later need an indexed account-session registry.

## APIs

- GET /api/mobile/account/session/ -> authenticated session check and CSRF cookie
- GET /api/mobile/account/sessions/ -> sessions for the caller, with opaque IDs
- POST /api/mobile/account/sessions/logout/ -> {"session_id": "<opaque ID>"} or {"all": true}
- Existing POST /api/mobile/account/profile/password/ and /api/mobile/auth/reset-password/ return session_ended: true on success.

All device/session API responses are no-store. Session cookies and push tokens must not appear in screenshots, test output, logs, or documentation.

## Validation

```powershell
# Isolated in-memory SQLite session tests, ownership/CSRF/stamp checks, and legacy login compatibility.
python -m unittest core.test_account_sessions core.test_web_login
python -m unittest core.test_candidate_push
```

```powershell
flutter test test/session_http_client_test.dart test/account_sessions_screen_test.dart
flutter analyze
```

The backend session tests configure an in-memory database and must run as the isolated command above, not against production settings. The full Django check may still be blocked locally by the existing missing numpy dependency in the face service.

Reference: https://docs.djangoproject.com/en/6.0/topics/http/sessions/
