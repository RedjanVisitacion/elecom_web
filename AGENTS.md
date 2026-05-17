# Agent Instructions (Flutter app: `elecom_mobile`)

> Intended for any AI coding agent working in this workspace. If you maintain `CLAUDE.md` or `GEMINI.md` elsewhere, keep them aligned with this file.

This repository is a **Flutter** client for the ELECOM voting app. Optimize for **fast, safe iteration**: small changes, `flutter analyze` clean, and runnable builds.

## What this repo is (and is not)

- **This repo (`elecom_mobile`)**: Flutter UI, local config, and HTTP calls to the backend. There is **no Django/Python API code here**.
- **Backend (Django)**: Lives in a **separate** tree, typically next to this project, e.g. `F:\elecom_web\backend` (contains `manage.py`, `core/settings.py`, `core/urls.py`, `core/views.py`, `elecom_auth/`, `.env`). If the user mentions “the backend,” **open or reference that path explicitly**; it is not under `lib/backend/` unless they added a stub folder.

Agents fixing **404/500 on API routes**, **email/OTP**, or **DB behavior** must edit the **Django backend** project, not only this Flutter repo.

## Repo map (where to put code)

- **App entrypoint**: `lib/main.dart` boots notifications/services then runs `ElecomApp`.
- **App shell / routing / top-level widgets**: `lib/app/`
- **Reusable “core” concerns** (config, networking, session, notifications, ledger, etc.): `lib/core/`
- **Feature modules** (screens, controllers, feature-specific widgets/services): `lib/features/`
- **Assets**: `assets/` and `pubspec.yaml` `flutter/assets`

## API base URL (Flutter)

- **Preferred**: `flutter run --dart-define=API_BASE_URL=http://<host>:8000`
- **Implementation**: `lib/core/config/api_config.dart` reads `String.fromEnvironment('API_BASE_URL')`. If empty, it falls back to:
  - Android emulator/device: `http://192.168.1.171:8000` (LAN IP — adjust if the user’s PC address differs)
  - Other platforms: `http://127.0.0.1:8000`
- **Rule**: Do not scatter hardcoded base URLs; use `ApiConfig.baseUrl` (or the same pattern) for new HTTP code.

## Mobile HTTP API shape (contract hints)

The app calls Django under **`{baseUrl}/api/mobile/...`** for most mobile flows. Examples:

- Forgot password: `POST /api/mobile/auth/forgot-password/`, `POST /api/mobile/auth/verify-otp/`, `POST /api/mobile/auth/reset-password/` (see `lib/features/auth/data/forgot_password_api.dart`). Step 1 returns **404** with `ok: false` when no account matches the Student ID or email (no OTP is sent).
- Responses are usually JSON with an **`ok`** boolean; clients may throw if the body is not JSON (e.g. Django HTML error pages).

If the client gets **404**, check **`core/urls.py`** on the backend for the path. If **500** with “unexpected” in the app, the server may have returned **non-JSON**; check Django logs and the matching view in **`core/views.py`**.

## Backend configuration (high level)

The Django server reads **`backend/.env`** (loaded in `core/settings.py`). Relevant knobs agents often touch:

- **Database**: `DATABASES` / `DB_*` as used in that project’s settings.
- **Email (forgot-password OTP)**: `EMAIL_BACKEND`, `EMAIL_HOST*`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`, `DEFAULT_FROM_EMAIL`. Default backend may be **console** (no real inbox) unless SMTP is set in `.env`.

Restart **`runserver`** (or the production process) after changing `.env` or URL routes.

## Running the app (local)

- **Install deps**: `flutter pub get`
- **Run**: `flutter run`
- **Optional**: `flutter run --dart-define=API_BASE_URL=http://<host>:8000`

## Quality gates (before handing back)

- **Analyze**: `flutter analyze`
- **Format**: `dart format .`
- **Tests**: `flutter test` (when tests exist/are relevant to the change)

## Engineering conventions (for changes in this repo)

- **Prefer feature-first placement**: UI/state for a feature goes under `lib/features/<feature>/...`. Shared utilities go in `lib/core/...`.
- **Avoid mixing state management styles** within one flow; follow existing patterns in the closest feature/module.
- **Networking**: keep API base URL decisions centralized in `ApiConfig`; do not hardcode new base URLs in random services/widgets.
- **Keep diffs tight**: avoid drive-by refactors unless necessary to complete the task.

## Git hygiene (important)

Do **not** commit build outputs or IDE caches. These paths should remain untracked/ignored:

- `.dart_tool/`
- `build/`
- `android/.gradle/` (and similar Gradle caches)
- Platform build folders under `android/app/` (`debug`, `profile`, `release`)

If they show up as untracked changes, they should be removed from git tracking (if accidentally added) and kept ignored.

## When things break

- Start from the actual error output (compile/runtime/logcat / Django traceback) and fix the *root cause*.
- For **API** issues, confirm **which host** the device hits (`ApiConfig`) and **which repo** owns the route (Flutter vs `elecom_web/backend`).
- Prefer deterministic reproduction (minimal steps) and add/adjust tests where feasible.
