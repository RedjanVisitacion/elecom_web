import io
import json
import unittest
from unittest.mock import patch
from urllib.error import HTTPError, URLError

from django.conf import settings
if not settings.configured:
    settings.configure()
from django.test import SimpleTestCase, override_settings
from core.textbee_sms import send_otp_sms


@override_settings(TEXTBEE_API_KEY="test-key", TEXTBEE_DEVICE_ID="test-device", TEXTBEE_SIM_SUBSCRIPTION_ID="2")
class TextBeeTests(SimpleTestCase):
    def response(self, body):
        response = unittest.mock.MagicMock()
        response.__enter__.return_value = response
        response.status = 200
        response.read.return_value = json.dumps(body).encode()
        return response

    @patch("core.textbee_sms.urllib.request.urlopen")
    def test_tm_subscription_and_normalization(self, send):
        send.return_value = self.response({"data": {"success": True, "smsBatchId": "batch"}})
        send_otp_sms("09171234567", "123456", 10)
        request = send.call_args.args[0]
        payload = json.loads(request.data)
        self.assertEqual(payload["simSubscriptionId"], 2)
        self.assertEqual(payload["message"], "ELECOM code: 123456. Valid for 10 minutes. Do not share.")
        self.assertTrue(payload["message"].isascii())
        self.assertLessEqual(len(payload["message"]), 160)
        self.assertEqual(payload["recipients"], ["+639171234567"])
        self.assertEqual(request.get_header("X-api-key"), "test-key")
        self.assertEqual(request.get_header("User-agent"), "ELECOM-Backend/1.0")
        self.assertEqual(request.get_header("Accept"), "application/json")
        self.assertEqual(send.call_count, 1)

    @override_settings(TEXTBEE_SIM_SUBSCRIPTION_ID="")
    @patch("core.textbee_sms.urllib.request.urlopen")
    def test_default_sim_matches_website_send(self, send):
        send.return_value = self.response({"data": {"success": True, "smsBatchId": "batch"}})
        send_otp_sms("09171234567", "123456", 10)
        payload = json.loads(send.call_args.args[0].data)
        self.assertNotIn("simSubscriptionId", payload)
        self.assertEqual(payload["deviceId"], "test-device")
        self.assertEqual(payload["recipients"], ["+639171234567"])

    @patch("core.textbee_sms.urllib.request.urlopen")
    def test_no_queue_confirmation_fails(self, send):
        for body in ({"data": {"success": False}}, {"data": {"success": True}}, []):
            send.return_value = self.response(body)
            with self.assertRaises(RuntimeError):
                send_otp_sms("09171234567", "123456", 10)

    @patch("core.textbee_sms.urllib.request.urlopen")
    def test_invalid_config_and_phone_do_not_send(self, send):
        with override_settings(TEXTBEE_API_KEY=""):
            with self.assertRaises(RuntimeError):
                send_otp_sms("09171234567", "123456", 10)
        with self.assertRaises(RuntimeError):
            send_otp_sms("123", "123456", 10)
        with override_settings(TEXTBEE_SIM_SUBSCRIPTION_ID="-1"):
            with self.assertRaises(RuntimeError):
                send_otp_sms("09171234567", "123456", 10)
        send.assert_not_called()

    @patch("core.textbee_sms.urllib.request.urlopen")
    def test_http_error_does_not_expose_body_or_retry(self, send):
        send.side_effect = HTTPError("https://example.com", 401, "bad", {}, io.BytesIO(b"secret"))
        with self.assertRaisesRegex(RuntimeError, "API key was rejected"):
            send_otp_sms("09171234567", "123456", 10)
        self.assertEqual(send.call_count, 1)

    @patch("core.textbee_sms.urllib.request.urlopen", side_effect=URLError("secret"))
    def test_network_error(self, send):
        with self.assertRaisesRegex(RuntimeError, "could not be reached"):
            send_otp_sms("09171234567", "123456", 10)
