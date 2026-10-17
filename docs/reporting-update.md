# Reporting and workspace update — 17 October 2026

## Available now

- `/analytics`: real imported Meta campaigns, shared channel/account/currency-timezone/date/search/status filters, metric columns, campaign/account/period dimensions, day/week/month grouping, comparison, sorting and pagination. Missing coverage is unavailable, not a fabricated zero.
- Analytics presets save applied filters, dimensions and columns per user/workspace. The Reports library opens the correct report type. CSV shares calculations and filters, preserves decimal money and neutralizes spreadsheet formulas. Print / Save PDF prints all filtered rows through the browser; it is not scheduled PDF generation or email delivery.
- `/overview`: Meta spend versus imported Shopify retained merchandise trends, grouping, previous-period comparison, channel spend breakdown and accessible tables. Shopify snapshots are not labeled as complete Shopify Analytics Net Sales. MER remains unavailable until actual sales coverage and all-channel spend are established.
- Shopify product CSV shares the table's dates/search/status/sorting and exports all matching products across pages, with import-coverage caveats and no customer identities.
- Combined Overview exports a source-comparison CSV with separate summaries, trends, channel spend and optional prior-period values. Source currency/timezone/coverage and metric definitions remain explicit; the file does not invent unified revenue or MER.
- `/alerts` now supports saved reporting rules, AND/OR conditions, dry runs, cooldown, automatic in-app notifications, review status and immutable evaluation snapshots. See [Rules & Alerts](rules-alerts.md). This does not send email or change ads.
- Owner/Admin disconnect requires confirmation: stored credentials are removed, active jobs lose their leases, advertising account selection stops and Shopify event ingestion is disabled. Imports remain stored. Provider-side authorization is **not automatically revoked**; the UI identifies the provider settings for removal.
- Settings support Analyst reporting access, integration audit history and Owner-confirmed browser-event retention from 7–90 days. Shortening retention deletes older browser events in that workspace, without deleting order/financial snapshots, presets or audit history. Hydration uses server-supplied choices/reference time and stable timestamps.
- `/onboarding` gives authenticated users workspace/team setup, independent source connection/import checks and report links. Public signup/mailbox verification are separate unfinished features.
- Integrations show scopes, record counts, failures, pending imports, last success and two-minute freshness warnings. `/api/health` checks migrations through 016 and unsafe runtime-role flags; it does not certify external providers or workers.

## Automatic local imports

Run the app in one terminal and the workers in another:

```powershell
npm.cmd run dev
```

```powershell
npm.cmd run workers:watch
```

`SYNC_INTERVAL_SECONDS` defaults to 60 (range 60–86400); queues are checked every five seconds. Independent sources skip missing configuration, use existing Owner/Admin worker identities, and import selected advertising accounts / connected stores. Workspace/provider locks deduplicate active and recently scheduled jobs. Provider execution/backoff can delay completion: this is not a guarantee of source freshness within two minutes. Visible advertising/overview dashboards refresh every 15 seconds; Shopify activity refresh remains five seconds.

Meta refresh the last 30 reporting days in account timezone. Shopify retains its 59-day updated-order window plus product import. These are not unlimited historical backfills. Workers support process environment injection without a local `.env`. Closing the runner, switching off the PC or losing network access stops automatic imports. No hosting was activated.

## Shopify webhook receiver

`POST /api/shopify/webhooks` verifies exact raw bytes using the app client secret and `X-Shopify-Hmac-SHA256`, limits bodies to 1 MiB, validates shop/topic/event ID and stores receipt metadata only. Provider event IDs deduplicate deliveries. Supported topics queue reconciliation; a signed, suitably timestamped uninstall notification disconnects the workspace connection. Raw customer/order payloads are not stored.

Supported topics: `orders/create`, `orders/updated`, `orders/cancelled`, `refunds/create`, `products/create`, `products/update`, `products/delete`, `app/uninstalled`.

**Subscriptions have not been registered or live-verified.** Configure app-owned HTTPS subscriptions in the existing Shopify developer app to the current public app origin plus `/api/shopify/webhooks`, using the pinned API version. App-owned deliveries use the app secret; manually created shop-admin webhooks can use a different signing secret. Never put a secret in a URL. Keep the worker runner active; polling remains the fallback. Public-app compliance, deleted-resource reconciliation and App Store readiness remain separate work.

References: [delivery verification](https://shopify.dev/docs/apps/build/webhooks/verify-deliveries), [subscription setup](https://shopify.dev/docs/apps/build/webhooks/get-started?deliveryMethod=https), [ShopifyQL access requirements](https://shopify.dev/docs/apps/build/shopifyql/graphql-admin-api).

## Still outstanding

The complete PDF is **not** finished:

2. Verified Shopify event-date Net Sales, historical coverage and representative real order/refund reconciliation before MER. ShopifyQL requires `read_reports` and protected customer-data approval; order snapshots do not substitute for that access.
3. Automatic provider-side revocation, live webhook subscriptions, compliance/deleted-resource handling, resumable large backfills, monitoring alerts and backup/restore verification.
4. Public signup, mailbox verification, password recovery, automatic invitation emails and scheduled email/PDF reports. No mail service is configured and no email was sent.
5. P1/P2 attribution journeys/models, profit/COGS/fees, guarded advertising writes, billing and broader notification delivery/preferences. Reporting rules and in-app alerts are implemented; external delivery is not.

Deployment remains deferred. The approved Meta-first release order remains in place. Real Meta and Shopify automatic imports completed on both 16 and 17 October; this does not verify nonzero advertising/sales figures.

## Verification — 17 October

Latest: TypeScript, production build and all 82 unit/database tests passed, together with nine production browser checks including Rules & Alerts. Four preview checks passed in the preceding reporting increment. Additional authenticated checks in that increment generated Analytics, Shopify and Combined CSV files, verified cross-origin requests receive 403, and verified printable report rendering. No runtime errors or document overflow appeared at 375, 768 and 1440 pixels. Test-created invitations were revoked and presets removed by the browser suite; append-only audit/export history retains genuine verification actions. No customer email was sent, no provider connection was disconnected, no retention policy was changed and no test rules were saved in the user's workspace during verification.

The Shopify toolkit documentation search failed; official Shopify documentation was used instead. Its GraphQL validator cannot validate the plain TypeScript HTTP/HMAC handler (it rejects the `import` syntax); that handler was verified through TypeScript and dedicated signature/input tests, not claimed as GraphQL-schema validated.
