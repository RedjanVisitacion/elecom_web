# Agent Instructions (ELECOM workspace)

> Intended for any AI coding agent working in this workspace. If you maintain `CLAUDE.md` or `GEMINI.md` elsewhere, keep them aligned with this file.

This workspace contains the ELECOM voting system across multiple surfaces. Optimize for fast, safe iteration: small changes, correct repo/file ownership, clean checks, and no assumptions about what has already been staged, pushed, or deployed.

## What This Workspace Is

- **Flutter mobile app (`elecom_mobile`)**: Flutter UI, local config, and HTTP calls to the backend. There is no Django/Python API code inside the Flutter app.
- **Django backend**: `F:\elecom_web\backend` (contains `manage.py`, `core/settings.py`, `core/urls.py`, `core/views.py`, `elecom_auth/`, `.env`).
- **Static web/admin frontend**: `F:\elecom_web\frontend\org_elecom\`, especially `frontend/org_elecom/elecom_admin/*.html`.

Agents fixing **404/500 API routes, database behavior, election scoping, reset behavior, OTP/email, reports, or network authorization** must inspect the Django backend. Agents changing **mobile screens or mobile HTTP calls** must edit Flutter files. Agents changing **web admin UI** must edit static admin HTML/CSS/JS.

## Shared Backend Contract

The web admin and Flutter app are different clients for the same Django backend and database. Do not hallucinate separate mobile-only data when the system already stores it in backend tables.

- Treat the Django backend as the source of truth for elections, candidates, votes, notifications, ratings, network authorization, and reports.
- Preserve API response contracts. Mobile endpoints usually return JSON with an `ok` boolean; do not let Django HTML error pages leak into mobile flows.
- For API errors, confirm the exact URL the client calls and check `backend/core/urls.py` and `backend/core/views.py`.
- Prefer adding or reusing `/api/mobile/...` endpoints for mobile behavior and `/api/admin/...` endpoints for admin behavior, unless an existing shared endpoint is already the correct contract.
- Keep election scoping consistent across clients. Records commonly use `election_id`; active/current behavior must not accidentally hide archived election data where the UI asks for a previous year.
- PostgreSQL is used. Never use SQLite-only DDL such as `AUTOINCREMENT`; use Django migrations or PostgreSQL-safe SQL (`SERIAL`, `BIGSERIAL`, etc.).

## Flutter Repo Map

- **App entrypoint**: `lib/main.dart` boots notifications/services then runs `ElecomApp`.
- **App shell / routing / top-level widgets**: `lib/app/`
- **Reusable "core" concerns**: `lib/core/` (config, networking, session, notifications, ledger, etc.).
- **Feature modules**: `lib/features/`
- **Assets**: `assets/` and `pubspec.yaml` `flutter/assets`

## API Base URL (Flutter)

- Preferred run command: `flutter run --dart-define=API_BASE_URL=http://<host>:8000`
- Implementation: `lib/core/config/api_config.dart` reads `String.fromEnvironment('API_BASE_URL')`.
- If empty, current fallback is:
  - Android emulator/device: `http://192.168.1.171:8000` (LAN IP - adjust if the user's PC address differs).
  - Other platforms: `http://127.0.0.1:8000`
- Do not scatter hardcoded base URLs; use `ApiConfig.baseUrl` or the same centralized pattern.

## Mobile HTTP API Shape

The Flutter app calls Django under `{baseUrl}/api/mobile/...` for most mobile flows.

- Forgot password: `POST /api/mobile/auth/forgot-password/`, `POST /api/mobile/auth/verify-otp/`, `POST /api/mobile/auth/reset-password/` (see `lib/features/auth/data/forgot_password_api.dart`).
- Forgot-password step 1 returns `404` with `ok: false` when no account matches the Student ID or email; no OTP is sent.
- If the client gets `404`, check backend `core/urls.py`.
- If the app reports an unexpected `500`, the server may have returned non-JSON. Check Django logs and the matching view in `core/views.py`.

## Web Admin Files

- **Admin pages**: `frontend/org_elecom/elecom_admin/*.html`
- **Shared admin header/profile/notification bell JS**: `frontend/org_elecom/elecom_admin/admin_components/admin_js/admin_user_menu.js`
- **Shared admin CSS**: `frontend/org_elecom/elecom_admin/admin_components/admin_css/admin_dashboard.css`
- **Reports page JS/CSS**: `frontend/org_elecom/elecom_admin/admin_components/admin_js/elecom_reports.js`, `frontend/org_elecom/elecom_admin/admin_components/admin_css/elecom_reports.css`

When changing shared static assets used by admin pages, bump the query string version in HTML, e.g. `admin_user_menu.js?v=...`, `admin_dashboard.css?v=...`, or `elecom_reports.js?v=...`, so browser cache and collected static files do not keep stale code.

When adding sidebar items, update all admin HTML files that contain a hardcoded sidebar. The **Network Authorize** link should exist on every admin screen, but only `elecom_network_authorize.html` should mark it `active`.

## Current Admin Behavior To Preserve

- The **Reset Votes** sidebar item is intentionally removed from admin sidebars. Do not re-add it unless the user explicitly asks.
- Reset Votes is opened through the small hidden header control next to the notification bell.
- That hidden shortcut must ask for the admin password first, using the shared modal in `admin_user_menu.js`, then navigate to `elecom_reset.html`.
- Keep the notification bell visible and preserve its behavior in `admin_user_menu.js`.
- Resetting votes also clears user notifications. UI copy should say votes and notifications are deleted.
- Backend reset/status code should ensure the notifications table exists before counting or deleting notifications.
- The reset screen still requires typing `RESET`; the hidden header shortcut only gates navigation to the reset screen.

## Election-Scoped Admin Pages

- Election Management history action buttons must use the selected election ID, not dashboard/home URLs:
  - `/elections/<election_id>/edit-dates/`
  - `/elections/<election_id>/results/`
  - `/elections/<election_id>/reports/`
- Matching routes live in `backend/core/urls.py`; views live in `backend/core/views.py`.
- Buttons inside election loops should use the current election object (`election.id`, `election.pk`, or the local variable used by that template), not the active election by default.
- If an action button is a `<button>` inside a form, use `type="button"` unless it should submit the form.

## Results And Reports Lessons

- Results must support previewing the active/current election and archived previous elections. Prefer `history.pushState`/AJAX updates over full-page navigation when changing selected year, so the page does not blink.
- Reports must support **All elections** and a specific election year. The report API should receive `scope=all` for all elections, or `election_id=<id>` for a selected election.
- Do not let report summary endpoints silently fall back to the active election when the UI selected **All elections**.
- When filtering reports by date, apply the same date range to totals and candidate vote breakdowns.
- Report previews and exports should show the selected scope/year and date range clearly.
- PDF export in `elecom_reports.js` has been fragile. Avoid hidden/fixed temporary overlays for html2pdf; they caused blank PDFs. Prefer exporting from the real preview or a canvas source, ensure images are loaded/inlined first, and always bump the report JS query-string version after changes.

## Network Authorization Notes

The web admin Network Authorize page uses:

- Table: `authorized_networks`
- Table: `network_access_attempts`
- Backend endpoints: `/api/admin/network-settings/`, `/api/admin/network-logs/`, `/api/network/check/`

Important LAN/public IP distinction:

- For online deployments, Django sees the public/NAT request IP, not the phone's Wi-Fi/LAN IP.
- Network authorization should allow the voter device's local Wi-Fi IP/prefix, for example `192.168.101.4`, usually authorized as `192.168.101.0/24` or prefix `192.168.101`.
- `/api/network/check/` prefers client-supplied LAN IP fields: `device_ip`, `local_ip`, `network_ip`, or `ip_address` (query string or JSON body), plus headers `X-Device-Local-IP` / `X-Client-Local-IP`.
- If no LAN IP is supplied, the endpoint falls back to the server-seen request IP and returns `ip_source: "request"`; this is not suitable for mobile Wi-Fi LAN authorization behind NAT.
- Mobile/Flutter clients must read the device Wi-Fi/local IP and send it to `/api/mobile/network/check/` before voting.
- Browsers/servers cannot reliably read a phone's Wi-Fi SSID or private LAN IP for security reasons.
- SSID is stored/displayed for admin context only; do not depend on SSID for enforcement unless a trusted mobile client supplies it.

## Notifications And Ratings

- Mobile app ratings are stored in `app_ratings` through `/api/account/app-rating/`.
- The web admin bell loads rating notifications from `/api/admin/notifications/app-ratings/`.
- The unread badge is browser-local: `admin_user_menu.js` stores the latest seen rating id in `localStorage` under `elecom_admin_seen_rating_id`.
- User notifications are shared backend data. If mobile notification behavior changes, check backend notification tables/endpoints before inventing client-only state.

## Backend Configuration

The Django server reads `backend/.env` (loaded in `core/settings.py`). Relevant knobs agents often touch:

- **Database**: `DATABASES` / `DB_*` as used in that project's settings.
- **Email / forgot-password OTP**: `EMAIL_BACKEND`, `EMAIL_HOST*`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`, `DEFAULT_FROM_EMAIL`.
- Default email backend may be console (no real inbox) unless SMTP is set in `.env`.

Restart `runserver` or the production service after changing `.env`, URL routes, or backend behavior.

## Production Deploy Notes

On the Linux server, the Django/Gunicorn service is named:

- `elecom.service`

After backend or static frontend changes are deployed, run from `~/elecom_web/backend`:

```bash
python3 manage.py migrate
python3 manage.py collectstatic --noinput
sudo systemctl restart elecom
sudo systemctl restart nginx
sudo systemctl status elecom --no-pager
```

Do **not** assume the service is named `gunicorn`; `sudo systemctl restart gunicorn` fails on this server.

## Running The Flutter App Locally

- Install deps: `flutter pub get`
- Run: `flutter run`
- Optional: `flutter run --dart-define=API_BASE_URL=http://<host>:8000`

## Quality Gates

For Flutter changes:

- `dart format .`
- `flutter analyze`
- `flutter test` when tests exist or the touched flow is testable

For Django/backend changes:

- `python manage.py check`
- Run migrations only when models/schema changed and the user approves or the task requires it.

For admin JavaScript changes:

- `node --check <changed-js-file>`

For web static CSS/HTML-only changes, at minimum inspect the diff and bump relevant cache query strings.

## Engineering Conventions

- Prefer feature-first placement in Flutter: UI/state for a feature goes under `lib/features/<feature>/...`; shared utilities go in `lib/core/...`.
- Avoid mixing state management styles within one flow; follow existing patterns in the closest feature/module.
- Keep API base URL decisions centralized in `ApiConfig`.
- Keep diffs tight. Avoid drive-by refactors unless necessary to complete the task.
- Do not redesign the web system when the user asks for a targeted route, layout, or behavior fix.

## Git Hygiene

Do not assume changes are staged, committed, pushed, or deployed. Check `git status --short` before answering about what changed. Only run `git add`, `git commit`, or `git push` when the user explicitly asks or clearly approves it.

Do **not** commit build outputs or IDE caches. These paths should remain untracked/ignored:

- `.dart_tool/`
- `build/`
- `android/.gradle/`
- Platform build folders under `android/app/` (`debug`, `profile`, `release`)

If they show up as untracked changes, remove them from git tracking if accidentally added and keep them ignored.

## When Things Break

- Start from the actual error output (compile/runtime/logcat/Django traceback/browser console/network tab) and fix the root cause.
- For API issues, confirm which host the device hits (`ApiConfig`) and which repo owns the route (Flutter vs Django backend).
- For shared data issues, inspect the backend tables/views before changing Flutter UI logic.
- Prefer deterministic reproduction steps and add/adjust tests where feasible.
