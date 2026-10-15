# EleVote app-specific support

EleVote's AI prompt now uses a reviewed mobile workflow guide in
`backend/core/elevote_knowledge.py`. This supplies app knowledge at request time;
it does not train a new model or grant the assistant live account-changing tools.

## Source review

The guide was checked against these mobile sources under `elecom_mobile/lib/`:

| Area | Source |
|---|---|
| Login, absence of mobile self-sign-up | `features/auth/presentation/login_screen.dart` |
| Recovery, Email/SMS, Student ID/email, six-digit OTP | `features/auth/presentation/forgot_password_screen.dart`, `features/auth/data/forgot_password_api.dart` |
| Home, calendar, candidates, filing entry | `features/elecom/student_dashboard/student_dashboard.dart` |
| Enrollment, camera, liveness prompts | `features/elecom/face/face_enrollment_screen.dart`, `live_face_capture_screen.dart` |
| Vote Now, verification, eligible ballot, receipt | `features/elecom/election/election_screen.dart`, `receipt_screen.dart` |
| Results and transparency | `features/elecom/results/results_screen.dart`, `features/elecom/election/election_transparency_screen.dart` |
| Filing stages, PDFs, rejection, duplicates | `features/elecom/candidates/candidate_filing_screen.dart`, `features/elecom/data/candidate_application_policy.dart` |
| Certificate download/printing | `features/elecom/candidates/candidate_certificate_preview_screen.dart` |
| Profile fields and settings | `features/elecom/profile/account_settings_screen.dart`, `personal_information_screen.dart`, `notification_settings_screen.dart` |
| Support channels | `features/elecom/profile/elecom_faqs_screen.dart`, `elecom_about_screen.dart` |
| Installed-build update checks | `core/update/app_update_service.dart` |
| Chat sends, polling, takeover | `features/elecom/elevote/elevote_chat_screen.dart` |

Backend voter creation/import handlers in `backend/core/views.py` confirm that
administrators maintain voter records. Do not suggest a nonexistent Sign Up route
or send someone without an account into logged-in profile settings.

## Conversation and fallback behavior

- The provider receives up to 12 recent messages from the authenticated student's
  thread, limited to 2,000 characters each, plus the current question once.
- Admin replies are assistant context; user-provided role labels cannot create a
  new system instruction. Chat content is not authoritative election policy.
- Questions use English, Bisaya, Tagalog, and mixed language. Strong question words
  take priority over shared possessives; `paano kong wala akong account?` uses
  Tagalog rather than switching to Bisaya because of `akong`.
- Local fallback recognizes `paano poboto?`, missing accounts, login, missing OTP,
  supporting PDFs, rejected filings, certificate printing, notifications, calendar,
  support, and APK updates. It retains the previous topic/language for short
  follow-ups and handles acknowledgements without repeating the help menu.
- Fallback is still an intent-based safety net. General reasoning requires a
  configured, reachable AI provider. It cannot verify an individual account,
  submit a vote, alter candidacy, deliver an OTP, or confirm unpublished results.
- HTTP failures no longer put the provider response body into the exception log.
  Logs retain the HTTP status for diagnosis without dumping provider content.

## Validation and deployment

```powershell
python -m unittest core.test_elevote_languages core.test_elevote_knowledge
```

The provider-request test mocks the network. These checks do not prove live model
language quality, provider availability, or production deployment.

Deploy the three source modules (`views.py`, `elevote_languages.py`,
`elevote_knowledge.py`) and restart Gunicorn. No migration or APK rebuild is needed.
After deployment, test a fresh chat with the screenshot questions, an account
follow-up, and an acknowledgement. Check `journalctl -u gunicorn --since "5 minutes ago" --no-pager`
privately if replies keep falling back. Never share `.env`, credentials, or
unsanitized conversation logs.

Update the guide and regression cases whenever the actual app flows change.


## Groq model migration (2026-10-15)

Repeated `Groq request failed (HTTP 404)` was observed on the server. The local
configuration and previous code default used `llama-3.1-8b-instant`, which Groq's
[deprecation notice](https://console.groq.com/docs/deprecations) lists as retired
for free/developer accounts on 2026-08-16. The documented replacement is
`openai/gpt-oss-20b`. Defaults and the local model setting have been updated.

On production, edit the existing `/var/www/elecom/backend/.env` model line to:

```dotenv
GROQ_MODEL=openai/gpt-oss-20b
```

Do not change or share the API key. Git does not deploy `.env`. Deploy source
changes and restart Gunicorn, then send one fresh question and check for new
provider errors. This migration does not prove the server's configured model or
account access until tested there.

The request uses `max_completion_tokens=1024` and low reasoning effort for GPT-OSS
models. It reads the final `message.content`, not the reasoning field. See Groq's
[reasoning guide](https://console.groq.com/docs/reasoning). Offline regression
tests verify the payload; they do not make a paid/live completion request.
