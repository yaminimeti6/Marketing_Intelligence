> Scope update (17 October 2026): At the user's request, Google Ads has been removed from application UI, OAuth routes, workers, configuration and reporting/rules. Only Meta Ads and Shopify are active integrations. Historical Google migrations remain intact for database upgrade compatibility; earlier Google requirements below describe the original PDF, not current requested scope.

> Channel correction (17 October 2026): The user confirmed only Meta Ads is used. MER_CHANNELS is now meta; Google Ads is optional and does not block MER. Verified Net Sales, completed fresh Meta coverage, full account selection and positive spend are still required.

> Sales-report update (17 October 2026): Daily Shopify Net Sales import is implemented and live-verified for 30 closed shop-timezone days. Dashboard, Combined Overview and Combined CSV use guarded report values. MER requires the user-confirmed Meta + Google spend; Google setup is still pending. Earlier limitations below are historical. See [Net Sales and MER](shopify-net-sales.md).

# Shopify integration � connection and import foundation

> Historical increment record. For current features, setup and outstanding requirements, see [reporting update](reporting-update.md) and [PDF audit](pdf-feature-audit.md).

Authorized October 16, 2026. Existing storefront: https://metiveda.com/. The permanent myshopify.com domain and authorized app/store access are still awaited from the store administrator. The user explicitly asked to continue independent implementation while waiting. Public storefront access does not authorize Admin API access.

## Implemented and checked

- Official `@shopify/shopify-api` 15.0.1, standalone OAuth start/callback routes. Owner/admin-only POST with registered-origin check; SDK-signed HttpOnly/Secure cookies; HMAC verification; single-use hashed state bound to Northstar user/session/workspace and the allowlisted permanent shop. Duplicate callback parameters rejected. Ten-minute cookie and database state lifetime.
- Expiring offline authorization, required read_orders/read_products scopes, actual GraphQL store identity verification before saving connected status. Access and refresh tokens encrypted together using the existing workspace/provider/connection-bound AES-GCM envelope; no token DTOs, client storage or SDK logging.
- Additive migration 004 for shopify_oauth_states, shopify_stores and restricted shopify_records. All three have forced tenant RLS and owner/admin write checks. Migration applied locally without reset; existing Meta records preserved.
- Dedicated `npm.cmd run worker:shopify`, separate from Meta. It claims one Shopify job per workspace per pass, renews leases, retries transient failures with backoff and records sanitized errors. Token rotation locks the store credential row so concurrent refreshes are serialized. Expired refresh tokens require reauthorization. No recurring scheduler is claimed.
- Versioned GraphQL shop identity, paginated orders (including refund summaries) and products; only selected non-customer fields requested. Orders import a recent updated window within provider-permitted history. API version fallback, HTTP/GraphQL errors, partial GraphQL responses, throttling and repeating cursors fail honestly. Requests have deadlines and reject HTTP redirects. Imports upsert by source ID and record a completed checkpoint only after both resources finish.
- Integrations UI has truthful setup, authorization, import queue, freshness and error states. Missing credentials keep Connect disabled. Queueing is not displayed as completed import. Shopify financial cards remain unavailable.
- `npm.cmd run shopify:check` prints variable presence/format only. `.env.example` contains empty placeholders; private .env was not changed.

## Validation

27 unit/database tests passed, covering permanent-domain validation, callback constraints, official SDK signed cookies and bad HMAC, expiring offline scope/expiry checks, GraphQL failures/pagination, isolated migration application, single-use shop-bound state, idempotency, failure checkpoints and cross-tenant reads/writes. Provider tests use explicit isolated fixtures, never production demo records.

Production build and TypeScript passed. All 8 browser regressions passed, covering authenticated Meta reports, the disabled-unconfigured Shopify connection card, preview separation and responsive widths. The read-only GraphQL operations were validated successfully against Shopify's official 2026-10 schema. This is the schema validation target, not a secretly configured live store API version.

## Not yet complete

No live Shopify authorization, refresh or commerce import has been performed. Store address, Client ID/Secret, supported pinned API version, registered HTTPS callback and installation permissions are missing. No store settings, theme, products, checkout or purchases were changed.

Financial reconciliation and the real Shopify sales dashboard remain next work. Order-line/product-variant import, detailed refund/adjustment accounting, deleted-resource reconciliation, resumable large backfills/bulk API, webhooks/uninstall/compliance handling, disconnect/revocation, recurring scheduling and production monitoring are not implemented by this increment. Do not publish the integration as production-complete or expose financial KPIs from snapshots yet. Combined reporting follows reconciled Shopify sales. This snapshot importer does not promise unlimited history or delete old records on an empty response.

## Guided activation, when administrator access arrives

1. Confirm permanent shop address in Shopify Admin > Settings > Domains, app ownership/distribution and an authorized installer. Do not guess the myshopify.com address from metiveda.com.
2. Reuse a suitable existing developer app if available. Confirm scopes and supported API version. Configure real app values privately; no secrets in chat or public files.
3. Register the exact HTTPS callback `/api/integrations/shopify/callback` on the chosen app origin. Authorize while signed in to Northstar on that same origin. Connection is saved only after real provider validation.
4. Set SHOPIFY_WORKER_USER_ID to an existing owner/admin UUID. Queue import, run `npm.cmd run worker:shopify` and inspect actual completed jobs. Refresh/permission behavior still needs live verification.
5. Reconcile representative orders, cancellations/test orders and refunds before enabling sales totals. Broader order history may require additional approval; do not request it merely for setup tests.

## Official references checked October 16, 2026

- Standalone OAuth and SDK: https://shopify.dev/docs/apps/build/authentication-authorization/authenticate-standalone-apps?lang=node
- Expiring offline tokens: https://shopify.dev/docs/apps/build/authentication-authorization/migrate-to-expiring-offline-access-tokens
- Store fields: https://shopify.dev/docs/api/admin-graphql/latest/objects/Shop
- Order fields/history: https://shopify.dev/docs/api/admin-graphql/latest/objects/Order
- Official SDK OAuth/refresh implementation: https://github.com/Shopify/shopify-app-js/tree/main/packages/apps/shopify-api

Bundled documentation search failed with fetch failed; official web documentation and installed SDK source/types were inspected instead. Schema validation succeeded using the skill's validator with instrumentation opted out.


## Financial verification ? 17 October 2026

`npm.cmd run shopify:reconcile` now performs read-only, tenant-scoped snapshot reconciliation without printing order identifiers, customer data, tokens or monetary values. The current connected store has a completed financial import, 10 imported products and zero imported orders/refund examples. Its granted scopes are read_orders and read_products; read_reports is not granted. No real sales/refund reconciliation match is therefore claimed, and Net Sales/MER remain unavailable. The Shopify dashboard now explains these prerequisites. Six exact-decimal reconciliation tests and TypeScript passed.

For authoritative event-date Net Sales, ShopifyQL sales reporting requires read_reports and any Shopify-required data access approval. Configure the additional permission in the Shopify developer app and authorize it before implementing or trusting report imports; existing scope configuration is unchanged by these checks. Do not request read_all_orders merely to make empty snapshots appear complete. MER additionally requires complete marketing spend with identical date, currency and timezone scope. A payment identity match alone cannot enable it.

Official reference: https://shopify.dev/docs/api/admin-graphql/latest/queries/shopifyqlQuery
