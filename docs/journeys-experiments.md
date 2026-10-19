# Consent-based measurement and storefront experiments

Validation: production build and TypeScript passed; all 105 unit/database tests passed. Fixture tests cover consent withdrawal, source-scoped HMAC identities, read/write isolation, source opt-in, duplicate receipts/exposures, disabled tests, actual headline replacement before exposure, stable assignment and confidence interval edge cases. Authenticated production preview against Neon loaded both new pages without unavailable-storage messages, page errors or overflow at 375/768/1440 pixels. No user experiment was created. Real pixel delivery, live theme behavior, purchase linkage and mature experiment/cohort outcomes remain unverified until installation and real traffic.

The user explicitly approved pseudonymous visitor/customer/order linkage on 19 October 2026. No names, emails, addresses, raw URLs or free-text campaign names are collected by the measurement receiver. This changes the previous aggregate-only boundary. Old aggregate events cannot reconstruct journeys.

## Deployment and installation

Migrations 017 and 018 add opt-in measurement events, experiment configurations and deduplicated exposures. Both were applied to local and Neon databases without reset. Core health continues checking the existing core schema; new pages separately check measurement storage. There are no seeded customer events or experiments in the workspace.

The cloud source was enabled and the private combined file `.env.shopify-measurement.js` generated for the Netlify origin. It contains the existing aggregate pixel **plus** the new measurement subscriptions. In Shopify Settings → Customer events, replace the existing custom pixel's complete code with that file. Do not add a second copy of the aggregate pixel. Keep analytics and marketing privacy settings consistent with the new purpose. The file contains a public write capability and is excluded from Git. Do not share it in chat.

Rebuild the file for the cloud target when needed:

```powershell
node --env-file=.env.netlify --experimental-strip-types scripts/setup-journey-pixel.mjs
```

Disable the new receiver without disabling aggregate events:

```powershell
node --env-file=.env.netlify --experimental-strip-types scripts/setup-journey-pixel.mjs --disable
```

This does not automatically uninstall the theme snippet or pixel. No store code was installed by this change. Generation and source configuration are not evidence of live collection.

## Journeys, attribution and cohorts

Both analytics and marketing permissions must currently allow processing before any new pixel event is sent. Withdrawal stops later sends. Server parsing also requires both flags, but browser-supplied assertions are not cryptographic proof of consent. The receiver hashes Shopify `clientId` and optional checkout customer ID using server HMAC, namespaced to the source; raw identifiers are not persisted. IDs cross neither sources nor devices automatically. Rotating encryption/HMAC key or public source key breaks continuity.

Only `page_viewed` and `checkout_completed` are collected. Channels are a fixed allowlist derived in the browser from UTM source/referrer: Meta, organic, direct, other. Full URLs, click IDs and query strings are not sent. Attribution applies first-touch, last-touch and equal per-page-touch linear credit within 30 days before each matched checkout. Direct is included. Imported non-test/non-cancelled orders without a browser match remain unattributed. **Credit counts orders, not revenue or incremental impact.** Browser receipts and customer linkage remain untrusted; an order-ID match does not establish customer ownership. No financial totals, LTV or causal claims are manufactured.

Purchase cohorts group first **retained observed** matched purchase month in UTC, then distinct customer hashes active in months 0–2. Missing customer IDs do not become synthetic customers. Current and future months are immature. These are not verified acquisition cohorts, full historical retention, or customer-account identity resolution. Existing store data has not demonstrated paid/refunded cohort acceptance examples.

Reads apply workspace event-retention settings; ingest purges expired source events, and the existing owner retention purge now includes journey and exposure rows. Idle sources require a purge run for physical deletion. Reports bound input sizes and refuse partial totals. Public write functions restore caller tenant context and cannot read workspace data. Disabled/disconnected sources, revoked source managers and unknown keys cannot ingest. Browser/public write capabilities can be forged; these reports are observational, not billing or accounting sources.

## Real storefront assignment

In **A/B Experiments**, an owner/admin creates a draft for an enabled source. Choose headline/CTA text or two distinct same-store landing paths. Definitions are immutable once created. Start locks a 14-day collection window; retention must be at least 30 days. Copy the generated installation snippet after starting.

Install the snippet in the **store theme/entry page, not Custom Pixel**. For headline/CTA tests, attach the shown `data-northstar-experiment` attribute to the visible text element. The snippet changes `textContent`, not HTML or links. For landing-page tests, entry path must differ from both target paths; targets cannot be external URLs. It publishes exposure before redirecting and preserves the entry query string on the same store.

After Shopify analytics and marketing permission, one cryptographic random bit assigns A/B 50:50 and localStorage retains that arm per experiment/browser. No storage is read/written without those permissions. The original content remains until allowed; denied visitors are excluded. Users/devices clearing storage or consent changes can affect identity stability. Avoid overlapping tests. Custom-event delivery, client storage and IDs can be manipulated or blocked. Stopping collection stops ingestion; **remove the snippet to stop showing variants** before its baked-in expiry. The assignment snippet does not know later server-side stop state.

Expose one row per experiment and browser hash. Results include only participants whose seven-day outcome window has elapsed. Conversion means at least one matching imported order after exposure and within seven days, excluding test/cancelled orders. Shopify imports must be freshly completed before conversion figures are shown. Mature-arm conversion rates use descriptive 95% Wilson intervals; a large 50:50 sample-ratio imbalance is flagged. No automated experimental winner, significance comparison, sequential stopping guarantee or budget action is implemented. Wait until the planned collection and outcome windows complete and investigate tracking loss before interpreting.

## Meta creative experiments remain pending

The app's Meta connection is read-only. Genuine Meta-side experiments require provider experiment setup, appropriate write permissions, valid creatives/ad sets, budget review and explicit launch confirmation. This increment does not request broader Meta scopes, allocate advertising spend or launch Meta tests. Existing Creative Insights is still observational.

Official sources: [Shopify checkout events](https://shopify.dev/docs/api/web-pixels-api/standard-events/checkout_completed), [pixel privacy](https://shopify.dev/docs/api/web-pixels-api/pixel-privacy), [custom-event publication](https://shopify.dev/docs/api/web-pixels-api/emitting-data), [customer privacy](https://shopify.dev/docs/api/customer-privacy).
