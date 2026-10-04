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

### Local/offline PostgreSQL startup lessons

When switching from the online Kamatera/Gunicorn deployment back to offline Windows development, confirm the local PostgreSQL credentials before changing code.

- Start local PostgreSQL first, then run Django from `F:\elecom_web\backend`:
  - `python manage.py runserver 0.0.0.0:8000`
- If Django fails with `password authentication failed for user "elecom_user"`, the backend is running but PostgreSQL rejected the credentials in `backend/.env`.
- In the current local Windows setup, pgAdmin was connected to database `elecom_db` as user `postgres`, so local `.env` needed:
  - `DB_NAME=elecom_db`
  - `DB_USER=postgres`
  - `DB_PASSWORD=123` or the actual local postgres password
  - `DB_HOST=localhost`
  - `DB_PORT=5432`
- The old failing traceback may remain in the terminal scrollback. The successful signal is `System check identified no issues` and `Starting development server at http://0.0.0.0:8000/`.
- `python manage.py migrate` saying `No migrations to apply` means the local schema matches the local migration files. If online has newer records, candidates, elections, votes, or settings, that is a data/backup restore issue, not a migration issue.
- Do not assume Kamatera `.env` credentials and local Windows `.env` credentials are the same. Before going back online, ensure the server `.env` uses the production database credentials again.

## Production Deploy Notes

On the Linux server, the Django/Gunicorn service is named:

- **`gunicorn`** (not `elecom` — `sudo systemctl restart elecom` will fail)

The live backend runs from **`/var/www/elecom/backend`**, served by gunicorn with venv at `/var/www/elecom/venv`.
There is a separate clone at `~/elecom_web` used only for git pulls — it is **not** the live directory.

**Public URL**: `https://el3com.duckdns.org` (HTTPS via Nginx + Let's Encrypt).
The raw IP (`79.108.225.33:8000`) still works but is HTTP-only — do not use it in the Flutter app or share it with users.
Gunicorn binds to `127.0.0.1:8000`; Nginx handles the public-facing ports 80/443 and proxies to gunicorn.

### Nginx + HTTPS setup (already configured)

Nginx config lives at `/etc/nginx/sites-available/elecom` (symlinked to `sites-enabled`).
SSL certificate issued by Let's Encrypt via Certbot, stored at `/etc/letsencrypt/live/el3com.duckdns.org/`.
Certificate expires **2026-12-13** — Certbot auto-renews it via a scheduled task.

To renew manually if needed:
```bash
sudo certbot renew --dry-run   # test
sudo certbot renew             # actual renewal
sudo systemctl restart nginx
```

If Nginx is down after a server reboot:
```bash
sudo systemctl enable nginx
sudo systemctl start nginx
```

### Correct deploy sequence after pushing to GitHub

```bash
cd /var/www/elecom
git pull origin main
/var/www/elecom/venv/bin/python backend/manage.py collectstatic --noinput
sudo systemctl restart gunicorn
sudo systemctl status gunicorn --no-pager
```

Do **not** deploy from `~/elecom_web` — gunicorn does not serve from there.
If `git pull` aborts with "local changes would be overwritten", run:

```bash
git checkout backend/core/views.py   # or whichever file is conflicted
git pull origin main
sudo systemctl restart gunicorn
```

### Production server Python packages (venv)

Install missing packages into the production venv at `/var/www/elecom/venv`:

```bash
/var/www/elecom/venv/bin/pip install cloudinary
/var/www/elecom/venv/bin/pip install -r /var/www/elecom/backend/requirements.txt
```

Key packages that must be present:
- `cloudinary` — required for candidate photo and party logo uploads (Register Candidate, face enrollment)
- `faceplusplus-sdk` or equivalent — required for face enrollment and verification
- All packages in `backend/requirements.txt`

If a 500 error says "pip install cloudinary" or similar, the package is missing from the venv.

### Production .env

The production `.env` lives at `/var/www/elecom/backend/.env`. It is **not** committed to git (gitignored).
It must be created manually on the server. Do not copy the local Windows `.env` directly — DB credentials differ.

**After a fresh server setup or redeploy, the `.env` file will not exist.** Django will run with defaults — no Cloudinary, no email, no Face++, and the DB section in `settings.py` hardcodes local credentials that won't match production. Always create `.env` before testing anything.

**Do not include DB credentials** in the production `.env` unless you know the exact production PostgreSQL password.
The production DB uses peer/socket authentication; Django's built-in defaults (`elecom_backend` user, `127.0.0.1` host) connect without a password when no `DB_*` env vars are set.

To verify Django is reading `.env` correctly without exposing secrets:
```bash
/var/www/elecom/venv/bin/python -c "
import os, sys
sys.path.insert(0, '/var/www/elecom/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
import django; django.setup()
from django.conf import settings
print('Cloud name:', settings.CLOUDINARY_CLOUD_NAME)
print('API key:', settings.CLOUDINARY_API_KEY[:6] + '...' if settings.CLOUDINARY_API_KEY else 'MISSING')
"
```

Minimum required production `.env` contents:

```env
DEBUG=False
SECRET_KEY=elecom_secret_key

CLOUDINARY_CLOUD_NAME=<your_cloud_name>
CLOUDINARY_API_KEY=<your_api_key>
CLOUDINARY_API_SECRET=<your_api_secret>

FACEPP_API_KEY=<your_facepp_key>
FACEPP_API_SECRET=<your_facepp_secret>
FACEPP_FACESET_OUTER_ID=elecom_voters
FACEPP_DUPLICATE_THRESHOLD=80
FACEPP_VERIFY_THRESHOLD=80
FACE_VOTE_VERIFY_SESSION_MINUTES=20

EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=true
EMAIL_HOST_USER=<gmail_address>
EMAIL_HOST_PASSWORD=<gmail_app_password>
DEFAULT_FROM_EMAIL=ELECOM <<gmail_address>>

GROQ_API_KEY=<your_groq_key>
GROQ_MODEL=llama-3.1-8b-instant

APP_UPDATE_LATEST_VERSION=1.0.0
APP_UPDATE_LATEST_BUILD=2
APP_UPDATE_APK_URL=<apk_download_url>
APP_UPDATE_FORCE=false
APP_UPDATE_MESSAGE=New ELECOM update is available. Please download the latest version.
```

After creating or editing `.env`, always restart gunicorn:

```bash
sudo systemctl restart gunicorn
```

### Backup and restore notes

- Backup files are stored in `/var/www/elecom/backend/backup/admin_backups/` on the production server.
- The restore function (`_run_psql_restore` in `core/views.py`) calls `_ensure_audit_logs_table()` before running psql. This creates `public.audit_logs` if missing and patches all three audit trigger functions (`audit_row_change`, `deny_update_delete`, `vote_blocks_allow_status_update_only`) to use schema-qualified `public.audit_logs` so they work regardless of psql session `search_path`.
- If restore fails with `relation "audit_logs" does not exist`, it means the trigger functions in the live DB are still using the old unqualified reference. The fix is to ensure the new `views.py` is deployed and run the restore once — `_ensure_audit_logs_table()` will patch them permanently.
- The `ALTER TABLE ... DISABLE TRIGGER ALL` statements in the sanitized restore SQL require the DB user to own the tables. The production DB user (`elecom_backend` or `postgres`) must have ownership.

### Face++ rate limits

Face++ free plan allows ~1 request/second. `CONCURRENCY_LIMIT_EXCEEDED` errors from the mobile app mean the rate limit was hit. Retry after a second. For production load, upgrade the Face++ plan at console.faceplusplus.com.

### Gunicorn port conflict recovery

If gunicorn fails to start with `[Errno 98] Address already in use` on port 8000, stale gunicorn processes from a previous failed service cycle are holding the port. Systemd's `restart` does not kill them automatically.

**Diagnosis:**
```bash
sudo lsof -i :8000
```
This lists every PID holding port 8000.

**Fix — kill the stale PIDs, then restart:**
```bash
sudo kill -9 <PID1> <PID2>   # use the PIDs shown by lsof
sudo systemctl restart gunicorn
sudo systemctl status gunicorn --no-pager
```

**Root cause:** When the service was deleted/recreated while old worker processes were still alive, those orphaned processes kept the socket open. Systemd starts the new service unit but gunicorn cannot bind.

**After restart is confirmed `active (running)`**, verify the app responds:
```bash
curl -s http://localhost:8000/api/mobile/auth/ | head -c 200
```

### Gunicorn `No module named 'core'` on startup

This means gunicorn is not running from the correct working directory. The service file must have:
- `WorkingDirectory=/var/www/elecom/backend`
- **No** `Environment="PYTHONPATH=..."` line — that line conflicts with `WorkingDirectory` and breaks the import

Correct minimal service file (`/etc/systemd/system/gunicorn.service`):
```ini
[Unit]
Description=Gunicorn daemon for Django project
After=network.target

[Service]
User=root
WorkingDirectory=/var/www/elecom/backend
ExecStart=/var/www/elecom/venv/bin/gunicorn --access-logfile - --workers 3 --bind 127.0.0.1:8000 core.wsgi:application
Restart=on-failure
RestartSec=5s

[Install]
WantedBy=multi-user.target
```

Note: bind is `127.0.0.1:8000` (localhost only) because Nginx handles public traffic on ports 80/443 and proxies to gunicorn. Do **not** use `0.0.0.0:8000` in production — that exposes gunicorn directly without HTTPS.

After editing: `sudo systemctl daemon-reload && sudo systemctl restart gunicorn`

### Static files unstyled (no Nginx, gunicorn-only setup)

Gunicorn does not serve static files by default. Without Nginx in front, the browser gets a Django 404 HTML page instead of CSS/JS, making every page look completely unstyled.

**Fix: use whitenoise** — it plugs into Django's middleware and lets gunicorn serve static files directly.

1. Install on the server:
   ```bash
   /var/www/elecom/venv/bin/pip install whitenoise
   ```

2. In `backend/core/settings.py`, add whitenoise middleware **immediately after** `SecurityMiddleware`:
   ```python
   MIDDLEWARE = [
       'django.middleware.security.SecurityMiddleware',
       'whitenoise.middleware.WhiteNoiseMiddleware',  # ← add this
       ...
   ]
   ```
   Also add compressed static storage:
   ```python
   STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'
   ```

3. Commit, push, then on the server:
   ```bash
   cd /var/www/elecom
   git pull origin main
   /var/www/elecom/venv/bin/python backend/manage.py collectstatic --noinput
   sudo systemctl restart gunicorn
   ```

`STATIC_ROOT` is `/var/www/elecom_static` and `STATICFILES_DIRS` includes `frontend/` — collectstatic copies everything there, whitenoise serves it.

### Fresh server / clean deploy checklist

When standing up the server from scratch (or after the DB was wiped), do these in order:

1. **Pull the repo** into `/var/www/elecom` and install venv packages:
   ```bash
   cd /var/www/elecom
   git pull origin main
   /var/www/elecom/venv/bin/pip install -r /var/www/elecom/backend/requirements.txt
   ```

2. **Create `/var/www/elecom/backend/.env`** with all production credentials (Cloudinary, Face++, email, Groq). See the Production .env section above.

3. **Run migrations** to create all tables:
   ```bash
   /var/www/elecom/venv/bin/python /var/www/elecom/backend/manage.py migrate
   ```

4. **Insert the admin user** (plain-text password works on first login — change it after):
   ```sql
   sudo -u postgres psql -d elecom_db -c "
   INSERT INTO users (id, student_id, password_hash, created_at, role, department, position, phone, email, terms_accepted_at)
   VALUES (1, '2023304637', '2023304637', NOW(), 'admin', 'BSIT', '', '09308288544', 'rpsvcodes@gmail.com', NOW())
   ON CONFLICT (id) DO NOTHING;"
   ```

5. **Collect static files**:
   ```bash
   /var/www/elecom/venv/bin/python /var/www/elecom/backend/manage.py collectstatic --noinput
   ```

6. **Start services**:
   ```bash
   sudo systemctl restart gunicorn
   sudo systemctl restart nginx
   ```

7. **Import voters** via the admin panel (Voters Management → Import). If import fails with `No module named 'bcrypt'`, run `/var/www/elecom/venv/bin/pip install bcrypt` and restart gunicorn.

8. **Verify Cloudinary** by uploading a candidate photo. If it fails, check the `.env` credentials.

### Database is empty / "Invalid credentials" on login

If the login page shows "Invalid credentials" for known-good accounts, the `users` table is likely empty. Check:
```bash
sudo -u postgres psql -d elecom_db -c "SELECT COUNT(*) FROM users;"
```
If count is 0, either restore from backup (Backup & Restore page in admin) or insert the admin user manually (see Fresh deploy checklist above), then import voters via the admin panel.

### Voter import fails with `No module named 'bcrypt'`

`bcrypt` is required for hashing default voter passwords during import. Install it:
```bash
/var/www/elecom/venv/bin/pip install bcrypt
sudo systemctl restart gunicorn
```
It is listed in `backend/requirements.txt` — if it's missing after a fresh `pip install -r`, check that `requirements.txt` includes `bcrypt>=4.0.0`.

## Running The Flutter App Locally

- Install deps: `flutter pub get`
- Run: `flutter run`
- Optional: `flutter run --dart-define=API_BASE_URL=http://<host>:8000`
- For a real phone/local device, do not use `127.0.0.1`; that points to the phone itself. Run Django with `0.0.0.0:8000`, find the PC Wi-Fi/LAN IPv4 with `ipconfig`, then run Flutter with `--dart-define=API_BASE_URL=http://<PC_LAN_IP>:8000`.
- The phone and PC must be on the same Wi-Fi/LAN, and Windows Firewall must allow Python/Django on port `8000`.
- For Android emulator, `http://10.0.2.2:8000` may work; for a physical device, use the PC LAN IP.
- If Django returns `DisallowedHost` from a phone, add the PC LAN IP through `DJANGO_ALLOWED_HOSTS` in `backend/.env` or the `ALLOWED_HOSTS` list in `backend/core/settings.py`.

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

## USTP-Oroquieta Omnibus Election Code — Context

ELECOM is the digital implementation of the **USTP-Oroquieta Omnibus Election Code** (prepared by COMELEC Chairperson Ginbert A. Fernandez, approved by SSC President Juvel Enayo Lavornina). Understanding this code is essential for implementing election rules correctly.

### Governance Structure
- **COMELEC** oversees all SSC, College Student Council, and Unit Organization (UO) elections at USTP-Oroquieta Campus.
- COMELEC is composed of a Chairperson (Chief Commissioner), 5 Deputy Commissioners, and the Director of Student Affairs (ex-officio).
- The admin panel is used by COMELEC officers.

### Voter Qualifications (Article V)
- Must be officially enrolled USTP-Oroquieta undergraduate students.
- Must be SSC members.
- Disqualified if: suspended on election day, or found guilty of violating SSC/USTP provisions within 1 year prior.
- **System implication:** Voter import from student database; login by Student ID. Network authorization ensures voting only from campus.

### Candidate Qualifications (Articles III–IV)
- Bona fide USTP student, good moral character, not graduating, completed ≥2 consecutive semesters, not on probation.
- Cannot hold another office/organization simultaneously.
- Must submit: 2x2 ID photo, COR, grades, Certificate of Good Moral Character, PDS form, temporary resignation letter.
- Political parties need minimum 5 candidates to be recognized; independent candidates are allowed.
- **System implication:** Candidate registration screen collects and stores these requirements. Party/independent distinction is tracked.

### Election Timeline (Article VII)
- Elections held in **April or no later than first week of May**, second semester each academic year.
- 5-week calendar: Week 1 = info dissemination → Week 2 = COC filing, submissions → Week 3 = protests/deliberations → Weeks 4–5 = campaign, convocation, election proper, winner announcement.
- Election period lasts no more than **5 weeks** unless extended by COMELEC.
- **System implication:** Election Management sets start/end dates for the vote window. Results and Reports pages correspond to the canvassing and proclamation stages.

### Voting Process (Article XI)
- Election time: **8:00 AM to 5:00 PM, two consecutive days** (no lunch break).
- For automated elections: voters enter their **ID number** and cast votes on a computer.
- Right hand finger marked with indelible ink after voting (physical; not enforced by ELECOM digitally).
- **System implication:** The vote window enforces the time range. Face verification replaces the manual ID check + indelible ink conformity.

### Canvassing & Results (Article XII)
- Votes counted immediately after polls close.
- Ties resolved by **drawing of lots** at a public meeting — 5 days notice to tied candidates.
- **System implication:** Results page shows vote totals per candidate/position. Tie-breaking is a manual COMELEC decision; ELECOM shows the tie but does not auto-resolve it.

### Proclamation (Article XIII)
- COMELEC proclaims winners after complete tabulation.
- Results forwarded to Office of Student Affairs and posted on COMELEC Bulletin and official social media.
- **System implication:** Results and Reports pages serve as the official digital record. Transparency page shows blockchain/ledger hash for integrity.

### Penal Clause (Article XIV)
- Violations result in suspension or forfeiture of seat (if after proclamation).
- **System implication:** Audit logs and the Transparency page provide the paper trail for any disputes.

---

## Face++ Integration Lessons

### Free Plan Behavior
- Face++ free plan uses **shared QPS** with other users — there is NO guaranteed requests-per-second.
- `CONCURRENCY_LIMIT_EXCEEDED` errors mean the shared pool is saturated, not necessarily that the code is wrong.
- The error can appear misleadingly when the actual underlying issue is something else (e.g., `IMAGE_ERROR_UNSUPPORTED_FORMAT`) — always check server logs (`journalctl -u gunicorn`) for the real error.

### Enrollment Flow (views.py `_save_face_enrollment_facepp`)
- Makes 4–5 sequential Face++ calls: `create_faceset_if_missing` → `detect` → `search` → `addface` → `set_face_userid`.
- A `time.sleep(2.0)` delay is required **between each call** to avoid hitting the shared QPS limit.
- `create_faceset_if_missing()` is cached per-worker (`_faceset_confirmed` flag in `facepp_service.py`) — after first confirmation it skips the `getdetail` API call.
- Only `return_attributes=mask` is requested on detect (not the full eyestatus/mouthstatus/facequality set) to reduce API weight.

### Verification Flow (views.py `_face_verification_vote_handler`)
- Makes 2 sequential Face++ calls: `detect_face(live_bytes)` → `compare_faces(enrolled_token, live_token)`.
- A `time.sleep(2.0)` is placed between detect and compare.

### Retry Logic (facepp_service.py `_post`)
- On `CONCURRENCY_LIMIT_EXCEEDED`, retries up to 5 times with **exponential backoff**: 2s, 4s, 6s, 8s, 10s.
- All other Face++ errors are raised immediately and logged via `logger.error`.

### INVALID_FACE_TOKEN
- Occurs when a stored `facepp_face_token` no longer exists on Face++ (e.g., after creating a new Face++ account or if the faceset was deleted/reset).
- Fix: the affected user must **re-enroll** their face. The old DB record's token is stale.
- The error message is surfaced to the mobile app as-is; consider showing "Please re-enroll your face" instead of the raw token error.

### Image Format
- Flutter `camera.takePicture()` always produces **JPEG** regardless of `imageFormatGroup` (which only affects the preview stream for ML Kit).
- The enrollment image is sent as `multipart/form-data` with field name `face_image`.
- Face++ accepts JPEG via `image_base64` (base64-encoded bytes sent in the POST body).

---

## Nginx + Gunicorn Port Conflict Lessons

### Symptom: `ERR_TOO_MANY_REDIRECTS` + gunicorn `Connection in use: ('127.0.0.1', 8000)`
- Root cause: A stale or misconfigured Nginx config (`elecom-ip-redirect` or similar) was binding to port 8000, preventing gunicorn from starting.
- Nginx then proxied requests to itself (port 8000 → nginx → port 8000 → ...) causing the infinite redirect loop.

### Diagnosis
```bash
sudo lsof -i :8000          # see what process owns port 8000
sudo grep -r "listen 8000" /etc/nginx/   # find rogue nginx configs
```

### Fix
1. Remove the conflicting nginx site from `sites-enabled`:
   ```bash
   sudo rm /etc/nginx/sites-enabled/elecom-ip-redirect
   ```
2. Kill any stale PIDs holding port 8000 (use actual PID numbers, not placeholders):
   ```bash
   sudo kill -9 <PID>
   ```
3. Restart both services:
   ```bash
   sudo nginx -t
   sudo systemctl restart nginx
   sudo systemctl restart gunicorn
   sudo systemctl status gunicorn --no-pager
   ```

### Correct architecture
- Gunicorn binds to `127.0.0.1:8000` (localhost only).
- Nginx listens on ports **80** (redirect to HTTPS) and **443** (SSL), and proxies to gunicorn via `proxy_pass http://127.0.0.1:8000`.
- No other service should listen on port 8000.

---

## Admin CSS Consistency Rule

All admin HTML pages must reference the **same version** of `admin_dashboard.css`. When the dashboard is redesigned (e.g., new dark navy sidebar), bump the version query string on **every** admin HTML file, not just `admin_dashboard.html`.

Current correct version: `admin_dashboard.css?v=20260920-ustp-redesign`

Files that need updating together (check all when bumping):
- `admin_dashboard.html`, `elecom_backup_restore.html`, `elecom_candidates.html`, `elecom_dashboard.html`
- `elecom_election_date.html`, `elecom_elections.html`, `elecom_network_authorize.html`
- `elecom_register_candidate.html`, `elecom_reports.html`, `elecom_reset.html`
- `elecom_results.html`, `elecom_transparency.html`, `elecom_voters.html`
- `profile.html`, `search_results.html`

Page-specific CSS files (e.g., `elecom_backup_restore.css`) must **not** override the sidebar background color or active link color — those come from `admin_dashboard.css` and must be consistent across all pages.

---

## Live Chat System (Admin Support Inbox)

### Architecture

The EleVote Live Chat is a two-layer system:

1. **EleVote AI (Groq)** — auto-replies to voter messages via `POST /api/mobile/elevote/chat/`. This is the default behavior; every voter message gets an instant AI response.
2. **Admin takeover** — COMELEC officers can suppress AI replies and reply directly to a voter from the web admin Live Chat page.

### Database Tables

```
elevote_chat_messages   — all chat messages (user, assistant, admin roles)
elevote_chat_takeover   — per-student admin takeover state
```

`elevote_chat_messages` schema:
```sql
id         BIGSERIAL PRIMARY KEY
student_id varchar(64) NOT NULL
role       varchar(16) NOT NULL   -- 'user' | 'assistant' | 'admin'
content    text NOT NULL
model      varchar(128) NULL      -- Groq model name, NULL for human messages
created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
```

`elevote_chat_takeover` schema:
```sql
student_id varchar(64) PRIMARY KEY
active     boolean NOT NULL DEFAULT TRUE
taken_at   timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
taken_by   varchar(64) NULL       -- admin student_id who triggered takeover
```

Both tables are created by `_ensure_elevote_chat_table()` (called by `_ensure_all_system_tables()` middleware every 60s) — no separate migration needed.

### Backend Endpoints

| Method | URL | Purpose |
|--------|-----|---------|
| GET/POST/DELETE | `/api/mobile/elevote/chat/` | Voter sends message; AI replies (suppressed during takeover) |
| GET | `/api/admin/chat/conversations/` | List all voter conversations with last message, unread count, photo, takeover state |
| GET | `/api/admin/chat/thread/?student_id=X&since_id=Y` | Full message thread for one voter |
| POST | `/api/admin/chat/reply/` | Admin sends reply: `{ student_id, content }` |
| POST | `/api/admin/chat/takeover/` | Enable/disable admin takeover: `{ student_id, active: true|false }` |

All admin endpoints require `_require_admin(request)` (Django session, role=admin).

### Takeover Flow

1. Voter sends message → EleVote auto-replies (AI mode, default).
2. Admin opens Live Chat, sees conversation, clicks **"Take Over"**.
3. Backend upserts `elevote_chat_takeover` row with `active=TRUE` for that `student_id`.
4. Next voter message → `elevote_chat_api` calls `_is_admin_takeover_active(student_id)` → returns `true` → skips Groq, saves user message only, returns `{ ok, reply: null, takeover_active: true }`.
5. Mobile app: when `reply` is null and `takeover_active` is true, show no AI bubble (just the voter's sent message).
6. Admin types reply → `POST /api/admin/chat/reply/` saves `role='admin'` message.
7. Admin clicks **"Release to EleVote"** → `POST /api/admin/chat/takeover/` with `active=false` → AI resumes for future messages.

### Admin UI Files

- **Page**: `frontend/org_elecom/elecom_admin/elecom_live_chat.html`
- **JS**: `frontend/org_elecom/elecom_admin/admin_components/admin_js/elecom_live_chat.js`

The JS polls `/api/admin/chat/conversations/` every **8 seconds** (left panel) and `/api/admin/chat/thread/` every **4 seconds** (open thread). Always bump the JS `?v=` query string in the HTML after any JS change.

Key JS functions:
- `loadConversations()` — fetches conversation list, calls `renderConvList()`, syncs takeover UI for active thread
- `renderConvList()` — renders left panel; uses `avatarHtml(name, photoUrl)` for photo/initials avatar
- `openConversation(studentId)` — switches active thread, calls `updateTakeoverUI(conv)`
- `updateTakeoverUI(conv)` — syncs Take Over/Release button and banner based on `conv.takeover_active`
- `setTakeover(active)` — POSTs to `/api/admin/chat/takeover/`, updates local state, refreshes UI
- `msgBubble(msg)` — renders a message bubble; user bubbles show real profile photo (with initials fallback), EleVote AI shows navy "EV" badge, admin shows gold badge icon
- `avatarHtml(name, photoUrl)` — returns `<img>` with `onerror` fallback to initials `<div>`

### `admin_chat_conversations_api` — Common Bugs Fixed

- **`c.description[0]` is wrong** — `psycopg2` cursor description rows use `c[0]` (tuple index) not `c.description[0]`. All `cols = [...]` lines in this file use `c[0]`.
- **Missing try/except** — all three chat views now have try/except wrapping the DB calls, returning `{"ok": false, "error": "Database error: ..."}` on failure so the JS can display the actual error instead of staying frozen on "Loading conversations…".
- **Silent failure in loadConversations()** — the JS now shows an explicit error state (lock icon for 403, warning icon for other errors, wifi-off for network errors) instead of silently staying on the loading spinner.
- **display_name** — built with `CONCAT_WS(' ', first_name, last_name)` falling back to `email` then `student_id`. Column existence is checked via `information_schema.columns` first to handle schema variations.
- **photo_url** — fetched from `users.photo_url` (if column exists) and included in each conversation object so the admin can show the voter's real profile photo.
- **GROUP BY** — must include all non-aggregated columns from the `users` LEFT JOIN (`first_name`, `last_name`, `email`, `photo_url`).

### Sidebar Order Rule (Live Chat)

The correct sidebar order across **all** admin HTML pages is:
```
Transparency → Live Chat → Network Authorize
```
**Live Chat must appear before Network Authorize.** When adding or editing sidebars, verify both the order and consistent indentation across all admin HTML files.

Admin HTML files that contain a hardcoded sidebar (all must be kept in sync):
`admin_dashboard.html`, `elecom_backup_restore.html`, `elecom_candidates.html`, `elecom_dashboard.html`, `elecom_election_date.html`, `elecom_elections.html`, `elecom_live_chat.html`, `elecom_network_authorize.html`, `elecom_register_candidate.html`, `elecom_reports.html`, `elecom_reset.html`, `elecom_results.html`, `elecom_transparency.html`, `elecom_voters.html`, `profile.html`, `search_results.html`
