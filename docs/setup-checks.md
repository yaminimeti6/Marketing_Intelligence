# Local setup checks

Run `npm.cmd run setup:check` from the project directory. It checks provider configuration presence, scheduling interval, OAuth/app origin consistency, the application's database role and all migration files currently in `db/migrations`. Database queries run in a read-only transaction. It does not apply migrations, create invitations, send email, call providers or deploy anything.

An exit code of 1 means a core database, migration, scheduling or app-origin check failed. Optional provider and email configuration is reported separately and does not fail core readiness. A configured provider is not proof of working OAuth or current imports. The checker does not inspect whether workers are running, inbox delivery, DNS verification, backups or financial reconciliation.

Run `npm.cmd run email:check` for a focused local email check. It reports key presence and format, sender configuration and testing-sender restrictions without printing values or making network requests. `onboarding@resend.dev` only permits the Resend account recipient. Inviting an existing member is rejected before any email request, so the invitation form cannot be used to send a test to an existing Owner account.

Current local checks on 17 October 2026: runtime role is restricted, all 16 migrations are applied and configured callback origins match. Meta/Shopify settings are present. Google Ads has been removed from the application; Resend custom-domain DNS verification is waiting for access to the domain's existing DNS provider. The latest email configuration uses the testing sender. Hosting remains deferred.

Do not run invitation-creating browser tests against an active workspace to diagnose setup: even revoked invitations consume its 10-creations-per-hour quota. Use the read-only commands first; use a separate test database/workspace for mutation tests. Revoking an invitation does not reset the hourly quota.
