# Invitation email delivery

Team Settings supports sending an invitation through Resend when **Email this invitation** is selected. Owner/Admin permissions, invitation limits, single-use tokens and 72-hour expiry still apply. Manual sharing remains available. Existing invitations are not emailed retroactively.

Set these server-only variables in your private `.env`, then restart Next:

```dotenv
RESEND_API_KEY=
EMAIL_FROM=
APP_URL=
```

Use a Resend API key with sending permission and a plain sender address on a verified domain. `APP_URL` must be your application's public HTTPS origin, without a path. A local ngrok URL works only while your computer, app and tunnel are running. Do not commit credentials or paste them in chat. No hosting or paid service is activated by this change.

Settings enables the email checkbox when the configuration is syntactically complete. This does not prove that the API key or sender has been accepted by the service. Create an invitation for an intended recipient and select the checkbox to verify actual sending. Success means accepted by the provider; it does not confirm inbox delivery. A failure keeps the private invitation link available for manual sharing. Ambiguous timeouts are reported as unconfirmed. Reissuing an invitation revokes the previous invitation.

Requests use a fixed HTTPS provider endpoint, a 10-second timeout and an idempotency key based on the invitation ID. Provider response bodies and invitation tokens are not logged. Emails contain a plain-text invitation link, not customer commerce data. Invitation delivery currently runs during the server action; there is no background retry queue or delivery webhook. Revoking an invitation invalidates its link but cannot recall an email already accepted by the provider.

Rule alert emails, subscription preferences, scheduled report attachments, password resets and email verification are separate work. Rules remain in-app only. SMTP/Gmail is not configured by this adapter.

Provider reference: [Resend email API](https://resend.com/docs/api-reference/emails/send-email).

Local diagnostics: `npm.cmd run email:check` checks configuration without sending anything. `npm.cmd run setup:check` also checks database role, migrations and callback origins. See [setup checks](setup-checks.md).
