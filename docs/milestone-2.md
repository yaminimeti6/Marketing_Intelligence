# Milestone 2 — Meta connection and ingestion

> Historical increment record. For current features, setup and outstanding requirements, see [reporting update](reporting-update.md) and [PDF audit](pdf-feature-audit.md).

Authorized October 15, 2026, after local foundation verification. Implementation and final local checks completed October 16; the user supplied successful live OAuth/account discovery and worker-sync evidence. See meta-final-checks.md for the exact evidence, remaining live-data reconciliation and the local database snapshot discrepancy. Follow the user's step-by-step setup preference and wait for confirmation after each external configuration step. Shopify and later features remain out of scope.

## Initial implementation state (historical)

Native PostgreSQL, tenant isolation, encryption and Owner authentication are ready. Existing connections/credentials/job tables and queue primitives are available. Meta App ID, App Secret, supported Graph version and callback URI are not configured. OAuth endpoints, real API clients, empty-account UI and the sync worker are implemented in source. Migration 002 is prepared but has not been applied to the native database. No live Northstar-to-Meta OAuth connection or account data import has been verified. The environment template now contains Meta placeholders only; duplicate credential-bearing database URL entries were removed from that template. The private working database configuration was preserved.

Run `node scripts/check-meta-setup.mjs` for a read-only presence/format check. It prints variable names/status only, never values. Presence does not prove valid provider access.

## Guided setup order

1. Open https://developers.facebook.com/apps/ and confirm whether a suitable existing Meta app exists. Do not create duplicate apps or change existing production app settings without reviewing the chosen app's purpose.
2. Inspect the selected app's Marketing API and supported Facebook login/business login configuration. Verify current requirements and access for the user's own ad accounts versus customer accounts. Select the initial reporting permission set; advertising mutations are out of scope.
3. Establish an HTTPS development callback and confirm the chosen Graph API version in official documentation/app configuration. Planned callback path: `/api/integrations/meta/callback`. The route is a design contract at this stage, not an implemented endpoint. Register the exact final URI only when its route and domain are ready.
4. Configure real App ID and App Secret privately in .env, with the confirmed API version and callback URI. Configure login configuration ID only if required by the selected Meta login flow. Never paste secrets/tokens into chat, IDE-selected context, screenshots, browser bundles or logs.
5. Implement authenticated admin/owner OAuth start and callback, single-use expiring state bound to the session/workspace, denial/error handling, real server-side token exchange, granted-scope validation, encrypted storage and revocation/expiry handling.
6. Add tenant-scoped Meta account/campaign/ad set/ad tables with non-destructive migrations. Discover real authorized accounts, select multiple accounts and implement idempotent imports, queues, pagination, throttling, retries, backfill/checkpoints and truthful sync status. Verify against authorized real accounts. No fixture fallback.
7. Validate real provider behavior, isolation, denial/reconnect paths and data synchronization before declaring this milestone complete. Dashboard analytics remain the following reporting milestone.

## Source verification

Meta's official Marketing API collection lists developer app, token, authorized ad account and permission prerequisites: https://www.postman.com/meta/facebook-marketing-api/collection/0zr4mes/facebook-marketing-api-mapi . Direct Meta authorization/login documentation returned HTTP 429 during this review. Exact flow, permission access levels, endpoints and supported version must be verified before implementation; do not infer a current version from third-party examples.

Keep normal local login working. No fake connection, fabricated sync success, advertising writes or Shopify integration is authorized here.

## Implemented October 16, 2026

- POST /api/integrations/meta/start: signed-in Owner/Admin only, exact registered HTTPS-origin checks, short-lived hashed state bound to the current workspace/user/session. GET callback consumes state once and redirects only to the configured origin, with sanitized status codes.
- Server-only authorization-code and long-lived-token exchange, token debugger validation of App ID, user, ads_read scope and expiry, AES-GCM encrypted storage and no browser token exposure. Tokens are not stored if discovery fails.
- Real paginated ad account discovery. Zero accounts is a successful connected state, not proof of API failure or a reason to require billing. Reconnecting rediscovers newly granted accounts.
- Read clients for campaigns, ad sets, ads and daily Insights at all three levels. No write permissions or campaign mutations. Pinned API version is mandatory and is not guessed.
- Migration 002 adds single-use OAuth state, account selection, entity/source-Insights tables and queue leases under forced tenant RLS. Existing migration history is preserved. Run the migration only at the next guided step.
- The worker performs one bounded pass for META_WORKER_USER_ID (an existing workspace Owner/Admin UUID), processing at most one queued Meta job per workspace. Schedule repeated passes externally. It uses leases/heartbeats, exponential retry with jitter, expiry recovery, terminal failures, idempotent upserts and completed-range checkpoints. A failed job is labeled failed/queued, not successful; partial source rows can exist and freshness advances only on full completion. Retries restart the account import safely rather than resuming a provider cursor.
- Initial import covers a rolling 30-day account-date range. Worker date ranges and source account timezone/currency are preserved; dashboard aggregation and broader historical scheduling remain reporting-phase work. Empty successful Insights refreshes remove obsolete rows in the requested interval.
- Developer request/fetch/Server Function logging is disabled to avoid logging OAuth codes, tokens and form arguments. Production reverse proxies must independently redact callback query strings and authorization headers.
- No payment method, ad spend or second Facebook account is required for implementation. Missing real account access prevents live account/Insights reconciliation only. Existing demo design stays isolated under /design-preview and labeled DEMO DATA.

## Validation and next external step

17 automated tests and TypeScript passed. Tests use explicitly synthetic HTTP responses in isolated test files to check empty discovery, pagination safety, sanitized errors, token exchange, idempotent source import, state replay rejection and new-table tenant isolation. These are not live integration evidence. The native database read-only check found only 001_foundation applied and no new-table collisions. The final production build and 8 browser regression tests passed, including existing Owner login and responsive empty-state layouts. The native database was left unchanged in this step.

No existing Explorer token needs to be pasted into Northstar. OAuth will obtain its own token after private App ID/Secret, supported version and HTTPS redirect setup. Next guided step: apply the non-destructive 002 migration, then configure the existing Meta app privately, one step at a time. A real OAuth round trip with zero accounts is a valid acceptance result for the available account; real account hierarchy/Insights reconciliation remains explicitly pending until access is granted.

