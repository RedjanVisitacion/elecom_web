"""TextBee OTP gateway. API acceptance means queued, not delivered."""
import json
import logging
import re
import urllib.error
import urllib.request

from django.conf import settings

logger = logging.getLogger(__name__)


def send_otp_sms(phone, otp, expiry_minutes):
    key = str(getattr(settings, "TEXTBEE_API_KEY", "") or "").strip()
    device = str(getattr(settings, "TEXTBEE_DEVICE_ID", "") or "").strip()
    if not key or not device:
        raise RuntimeError("SMS is not configured. TextBee API key and device ID are required.")
    digits = re.sub(r"[^0-9]", "", str(phone or ""))
    if len(digits) == 11 and digits.startswith("09"):
        digits = "63" + digits[1:]
    elif len(digits) == 10 and digits.startswith("9"):
        digits = "63" + digits
    if not re.fullmatch(r"639[0-9]{9}", digits):
        raise RuntimeError("A valid Philippine mobile number is required.")
    payload = {
        "deviceId": device,
        "recipients": ["+" + digits],
        "message": f"Your ELECOM OTP is: {otp}. Valid for {expiry_minutes} minutes. Do not share this code.",
    }
    subscription = str(getattr(settings, "TEXTBEE_SIM_SUBSCRIPTION_ID", "") or "").strip()
    if subscription:
        try:
            subscription_id = int(subscription)
            if subscription_id < 0:
                raise ValueError
        except ValueError:
            raise RuntimeError("TEXTBEE_SIM_SUBSCRIPTION_ID must be a non-negative Android subscription ID.") from None
        payload["simSubscriptionId"] = subscription_id
    request = urllib.request.Request(
        "https://api.textbee.dev/api/v1/gateway/send-sms",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", "x-api-key": key},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            if response.status not in (200, 201):
                raise RuntimeError("TextBee did not accept the SMS request.")
            result = json.loads(response.read(65536).decode("utf-8"))
        data = result.get("data") if isinstance(result, dict) else None
        if not isinstance(data, dict) or data.get("success") is not True or not data.get("smsBatchId"):
            raise RuntimeError("TextBee did not confirm the SMS was queued.")
    except urllib.error.HTTPError as error:
        logger.warning("TextBee OTP rejected | http_status=%s", error.code)
        reason = {401: "TextBee API key was rejected.", 429: "TextBee SMS limit reached."}.get(
            error.code, "TextBee rejected the SMS request. Check gateway configuration.")
        raise RuntimeError(reason) from None
    except (urllib.error.URLError, TimeoutError, OSError):
        logger.warning("TextBee OTP request could not reach the gateway")
        raise RuntimeError("SMS gateway could not be reached. Please try again.") from None
    except (ValueError, UnicodeError):
        raise RuntimeError("TextBee returned an invalid SMS response.") from None
    logger.info("TextBee OTP queued | sim_subscription=%s | batch_id=%s",
                subscription or "default", data["smsBatchId"])
