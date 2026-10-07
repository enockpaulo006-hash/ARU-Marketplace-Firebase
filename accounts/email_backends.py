import base64
import json
import logging
from email.mime.base import MIMEBase
from urllib import error, request

from django.conf import settings
from django.core.mail.backends.base import BaseEmailBackend


logger = logging.getLogger(__name__)


class ResendEmailBackend(BaseEmailBackend):
    """Send Django email messages through the Resend HTTPS API."""

    api_url = "https://api.resend.com/emails"

    def __init__(self, fail_silently=False, timeout=None, **kwargs):
        super().__init__(fail_silently=fail_silently, **kwargs)
        self.timeout = timeout or getattr(settings, "EMAIL_TIMEOUT", 10)

    def send_messages(self, email_messages):
        if not email_messages:
            return 0

        if not settings.RESEND_API_KEY:
            if self.fail_silently:
                return 0
            raise ValueError("RESEND_API_KEY is required for ResendEmailBackend.")

        sent_count = 0
        for email_message in email_messages:
            if not email_message.recipients():
                continue

            try:
                self._send_message(email_message)
            except Exception:
                logger.exception("Failed to send email through Resend API.")
                if not self.fail_silently:
                    raise
            else:
                sent_count += 1

        return sent_count

    def _send_message(self, email_message):
        payload = {
            "from": self._from_email(email_message),
            "to": list(email_message.to),
            "subject": email_message.subject,
        }

        if email_message.body:
            payload["text"] = email_message.body

        html_body = self._html_body(email_message)
        if html_body:
            payload["html"] = html_body

        self._add_optional_fields(payload, email_message)

        data = json.dumps(payload).encode("utf-8")
        api_request = request.Request(
            self.api_url,
            data=data,
            headers={
                "Authorization": f"Bearer {settings.RESEND_API_KEY}",
                "Content-Type": "application/json",
                "User-Agent": "arumarket-django/1.0",
            },
            method="POST",
        )

        try:
            with request.urlopen(api_request, timeout=self.timeout) as response:
                if response.status < 200 or response.status >= 300:
                    detail = response.read().decode("utf-8", errors="replace")
                    raise RuntimeError(
                        f"Resend API returned status {response.status}: {detail}"
                    )
        except error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"Resend API returned status {exc.code}: {detail}") from exc

    def _from_email(self, email_message):
        return (
            getattr(settings, "RESEND_FROM_EMAIL", "")
            or email_message.from_email
            or settings.DEFAULT_FROM_EMAIL
        )

    def _html_body(self, email_message):
        for content, mimetype in getattr(email_message, "alternatives", []):
            if mimetype == "text/html":
                return content
        return None

    def _add_optional_fields(self, payload, email_message):
        optional_recipients = {
            "cc": getattr(email_message, "cc", []),
            "bcc": getattr(email_message, "bcc", []),
            "reply_to": getattr(email_message, "reply_to", []),
        }
        for field, recipients in optional_recipients.items():
            if recipients:
                payload[field] = list(recipients)

        if email_message.extra_headers:
            payload["headers"] = dict(email_message.extra_headers)

        attachments = self._attachments(email_message)
        if attachments:
            payload["attachments"] = attachments

    def _attachments(self, email_message):
        attachments = []
        for attachment in email_message.attachments:
            filename, content = self._attachment_parts(attachment)
            if not filename:
                raise ValueError("Resend attachments require a filename.")

            attachments.append(
                {
                    "filename": filename,
                    "content": base64.b64encode(content).decode("ascii"),
                }
            )
        return attachments

    def _attachment_parts(self, attachment):
        if isinstance(attachment, MIMEBase):
            filename = attachment.get_filename()
            content = attachment.get_payload(decode=True)
            if content is None:
                content = attachment.get_payload()
        else:
            filename, content, _mimetype = attachment

        if isinstance(content, str):
            content = content.encode("utf-8")
        else:
            content = bytes(content)

        return filename, content
