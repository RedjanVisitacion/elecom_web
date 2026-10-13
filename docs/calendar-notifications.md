# Calendar and election notifications

Admin-created calendar events now insert one unread `schedule` notification per account and a matching push outbox row in the same transaction. Alerts include the activity title, date, time when provided, and location. Editing an event does not repeat the new-event announcement.

Election-date saves and election creation announce changed schedules immediately. Saving identical dates does not send a duplicate. The broadcast marker is locked while checking and advancing its state, preventing concurrent mobile polls from repeating alerts. Voting start/end and results publication also use the same inbox and push queue.

FCM messages retain the inbox notification ID for the mobile app's existing de-duplication. Notification preferences and account-bound device registration remain in effect. Push failure leaves the inbox entry intact and the outbox pending for retry; it does not undo a successful admin save. The existing candidate outbox table and command name are reused for compatibility; no new migration is needed.

## Production setup

Deploy the changed backend files and restart Gunicorn. This checkout has no `elecom_mobile/android/app/google-services.json`, so offline/background push cannot be validated here.

1. Register the Android application `com.elecom.mobile` in Firebase and put its matching `google-services.json` in `elecom_mobile/android/app/`. Follow [Firebase Flutter messaging setup](https://firebase.google.com/docs/cloud-messaging/flutter/get-started).
2. Configure Firebase Admin credentials for the same project on the server. Set `GOOGLE_APPLICATION_CREDENTIALS` to a private service-account file available to both Gunicorn and the scheduled command. Keep the private key out of the mobile app and Git. See [Firebase Admin setup](https://firebase.google.com/docs/admin/setup).
3. Install the backend requirements, which already include `firebase-admin`.
4. Run the existing retry command once per minute as the application service user, with the same database configuration and Firebase credentials as Gunicorn:

   ```bash
   /var/www/elecom/venv/bin/python /var/www/elecom/backend/manage.py deliver_candidate_push --limit 1000
   ```

   Schedule this with cron or a systemd timer. The command also checks election phase transitions so start/end/results alerts do not depend on an open mobile app. Existing polling remains a fallback. Immediate broadcasts run after commit in a background thread; the durable worker recovers pending work if the process exits.
5. Rebuild the APK with `bump_and_build.ps1` after adding the Firebase Android config. Install it, log in, enable push notifications, and grant Android notification permission.

After deployment, create one intended activity and verify its inbox entry and a background notification on a configured phone. Change an election date and repeat; an identical save should not duplicate the schedule notification. Live device receipt is not established by unit tests or outbox acceptance.

## Validation

```powershell
python -m unittest core.test_candidate_push core.test_schedule_notifications
```

18 isolated tests cover account-bound device registration, retry behavior, notification types, calendar create/edit/not-found, transaction error propagation, first schedule announcements, identical-save suppression, the marker lock, matching inbox/outbox IDs, deferred delivery, and the restored password-checked date-save branch.

Local `manage.py check` is blocked by missing `numpy` imported by the face service. PostgreSQL integration and production phone delivery still require verification after deployment.
