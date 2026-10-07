import base64
import io
import json
from unittest.mock import MagicMock
from unittest.mock import patch
from urllib.error import HTTPError

from django.core.mail import EmailMessage
from django.core.mail import EmailMultiAlternatives
from django.test import SimpleTestCase
from django.test import override_settings

from .email_backends import ResendEmailBackend


class ResendEmailBackendTests(SimpleTestCase):
    @override_settings(
        RESEND_API_KEY="re_test",
        RESEND_FROM_EMAIL="ARUMarket <onboarding@resend.dev>",
        DEFAULT_FROM_EMAIL="fallback@example.com",
        EMAIL_TIMEOUT=5,
    )
    @patch("accounts.email_backends.request.urlopen")
    def test_send_message_posts_django_email_to_resend_api(self, urlopen):
        response = MagicMock()
        response.__enter__.return_value.status = 200
        urlopen.return_value = response

        email = EmailMultiAlternatives(
            subject="Seller verification code",
            body="Your code is 123456",
            from_email="ignored@example.com",
            to=["buyer@example.com"],
            cc=["audit@example.com"],
            bcc=["private@example.com"],
            reply_to=["support@example.com"],
            headers={"X-App": "student-marketplace"},
        )
        email.attach_alternative("<p>Your code is <strong>123456</strong></p>", "text/html")
        email.attach("code.txt", "123456", "text/plain")

        sent_count = ResendEmailBackend(timeout=3).send_messages([email])

        self.assertEqual(sent_count, 1)
        api_request = urlopen.call_args.args[0]
        payload = json.loads(api_request.data.decode("utf-8"))
        self.assertEqual(api_request.full_url, "https://api.resend.com/emails")
        self.assertEqual(urlopen.call_args.kwargs["timeout"], 3)
        self.assertEqual(payload["from"], "ARUMarket <onboarding@resend.dev>")
        self.assertEqual(payload["to"], ["buyer@example.com"])
        self.assertEqual(payload["cc"], ["audit@example.com"])
        self.assertEqual(payload["bcc"], ["private@example.com"])
        self.assertEqual(payload["reply_to"], ["support@example.com"])
        self.assertEqual(payload["subject"], "Seller verification code")
        self.assertEqual(payload["text"], "Your code is 123456")
        self.assertEqual(payload["html"], "<p>Your code is <strong>123456</strong></p>")
        self.assertEqual(payload["headers"], {"X-App": "student-marketplace"})
        self.assertEqual(payload["attachments"][0]["filename"], "code.txt")
        self.assertEqual(
            payload["attachments"][0]["content"],
            base64.b64encode(b"123456").decode("ascii"),
        )

    @override_settings(RESEND_API_KEY="re_test", RESEND_FROM_EMAIL="")
    @patch("accounts.email_backends.request.urlopen")
    def test_send_message_skips_empty_recipient_list(self, urlopen):
        email = EmailMessage(
            subject="No recipients",
            body="This should not be sent.",
            from_email="sender@example.com",
            to=[],
        )

        sent_count = ResendEmailBackend().send_messages([email])

        self.assertEqual(sent_count, 0)
        urlopen.assert_not_called()

    @override_settings(RESEND_API_KEY="re_test", RESEND_FROM_EMAIL="")
    @patch("accounts.email_backends.logger.exception")
    @patch("accounts.email_backends.request.urlopen")
    def test_send_message_includes_resend_error_detail(self, urlopen, logger_exception):
        urlopen.side_effect = HTTPError(
            url="https://api.resend.com/emails",
            code=422,
            msg="Unprocessable Entity",
            hdrs=None,
            fp=io.BytesIO(b'{"message":"Domain is not verified"}'),
        )
        email = EmailMessage(
            subject="Verification",
            body="Your code is 123456",
            from_email="sender@example.com",
            to=["buyer@example.com"],
        )

        with self.assertRaisesRegex(RuntimeError, "422.*Domain is not verified"):
            ResendEmailBackend().send_messages([email])
        logger_exception.assert_called_once()
