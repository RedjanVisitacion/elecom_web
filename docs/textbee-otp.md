# TextBee SMS OTP setup

Install the TextBee gateway app on RMX3261, register it with your TextBee account,
grant SMS/phone permissions, enable the gateway, and keep it online.
Choose TM as Default SIM in TextBee. Copy the TM subscription ID from its SIM Cards
section; subscription IDs are not SIM slot indexes and can change after SIM swaps.
Copy the new TextBee device ID and API key; SMS Chef credentials cannot be reused.

Add to /var/www/elecom/backend/.env (replace placeholders):

```dotenv
SMS_PROVIDER=textbee
TEXTBEE_API_KEY=<TextBee API key>
TEXTBEE_DEVICE_ID=<TextBee device ID>
TEXTBEE_SIM_SUBSCRIPTION_ID=<current TM subscription ID>
```

Deploy the changed backend files through your normal Git workflow, then run each
command separately on the server:

```bash
cd /var/www/elecom
git pull origin main
sudo systemctl restart gunicorn
sudo systemctl is-active gunicorn
```

Request an OTP from ELECOM and check TextBee delivery status. The backend logs
`TextBee OTP queued` with the batch ID and selected subscription, without logging
the OTP, API key, or recipient. API acceptance only means queued, not delivered.
No APK rebuild or database migration is needed. Email OTP is unchanged.
No automatic fallback/retry is used, to avoid sending duplicate OTP messages.
For rollback set SMS_PROVIDER=smschef and restart Gunicorn.

API: https://textbee.dev/docs/sending-sms/sending-sms
SIM selection: https://textbee.dev/docs/sending-sms/choosing-a-sim
