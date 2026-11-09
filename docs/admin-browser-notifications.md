# Administrative in-app alerts and browser push

The notification bell retains the existing admin-only candidate filing, supporting-document review, backup, transparency and network alerts. New items produce in-app toasts after the first successful feed load; existing alerts do not replay on every page visit. The checkbox in the bell menu controls in-app toasts per admin/browser. Read/unread actions remain available independently.

Browser push is opt-in using the Enable browser push button in the bell dropdown. The browser must support Firebase web messaging, HTTPS, service workers and notification permission. It can receive alerts without an open ELECOM tab, subject to browser/OS background restrictions. Fully exiting the browser or disabling OS notifications can prevent delivery; this is not an always-running desktop agent.

Subscriptions are bound to the current admin login session. The worker rechecks session expiry, current role and password stamp before sending and deletes invalid subscriptions. Logout unlinks the browser subscription and ends the server session. Desktop notifications contain a generic prompt, never candidate names, student IDs or security details. Clicking opens /login/; normal authentication is required to reach the dashboard. Successful sends are remembered; failures remain retryable. A successful FCM request does not prove desktop receipt.

## Firebase setup

1. In the same ELECOM Firebase project used by the server's GOOGLE_APPLICATION_CREDENTIALS, register a Web app (not another Android app). Hosting setup is not required.
2. Copy only the public Firebase Web config fields. Set the backend's private .env variable ADMIN_FIREBASE_WEB_CONFIG to a single-line JSON object with apiKey, authDomain, projectId, messagingSenderId and appId. These are browser configuration values, not an Admin SDK private key.
3. In Project settings -> Cloud Messaging -> Web Push certificates, generate a key pair and set ADMIN_FIREBASE_VAPID_KEY to its public key. Never insert the Admin SDK private key into this config or any frontend asset.
4. Deploy the code, collectstatic, and restart Gunicorn. A new table admin_browser_push is created idempotently by registration/the worker; no existing tables or notifications are deleted. No additional package is required beyond existing firebase-admin.
5. Ensure /admin-notifications-sw.js reaches Django through Nginx (not a /static/ alias). It returns JavaScript with a public config allowlist and no-cache. It registers at root scope and has no fetch handler or offline caching.
6. After inspecting any existing unit files, install deploy/elecom-admin-push.service and deploy/elecom-admin-push.timer under /etc/systemd/system/, run systemctl daemon-reload, then systemctl enable --now elecom-admin-push.timer. This separate worker polls the same alert feed about once per minute even when no web page is open. Both worker and Gunicorn must read the same server .env and Firebase credentials. Timer setup is not automatically done by git pull.
7. Sign in as an admin, open the bell menu, click Enable browser push, and allow notifications. Existing feed items form a baseline rather than being sent as old alerts. Trigger one intended admin event and verify the bell/toast while visible, then a desktop notification with the tab closed. Test logout and the disable button too.

Browser push remains unavailable until the web config, VAPID public key and timer are configured. In-app alerts work after deployment without those Firebase web settings. Mobile notification tables and mobile FCM registration are separate and unchanged.

## Checks

Run from backend: manage.py test core.test_admin_browser_push core.test_report_organizations --noinput and manage.py check.
Run from repo root: node frontend/tests/admin_notifications.test.cjs. Syntax-check admin_notifications.js and admin_user_menu.js with node --check.

The tests mock database/FCM/browser APIs and do not establish production browser receipt.

Official setup: https://firebase.google.com/docs/cloud-messaging/web/get-started
Official receive behavior: https://firebase.google.com/docs/cloud-messaging/web/receive-messages
