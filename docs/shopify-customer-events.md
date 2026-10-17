# Northstar Shopify custom pixel

The receiver and dashboard support `product_viewed`, `product_added_to_cart`, and `checkout_started`. Installation in Shopify Admin is manual. “Receiver ready” does not claim that a pixel is installed or receiving real events. A real consent-approved storefront interaction is required to verify it end to end.

## Local installation

1. Apply versioned migrations: `npm.cmd run db:migrate`.
2. With the existing connected store and authorized Shopify worker identity configured, run `npm.cmd run shopify:pixel:setup`. This creates/rotates the store's write capability and generates the ignored local file `.env.shopify-pixel.js`. It never uses the Shopify access token in browser code. Rerunning setup invalidates the previous script's write key; replace the installed code after rotation.
3. In Shopify Admin → Settings → Customer events → Northstar Analytics, replace the sample code with the complete contents of `.env.shopify-pixel.js` and Save. No HTML script tags are needed.
4. Configure the pixel's data-use permission for Analytics and its data-sale setting to match the actual use. This receiver collects aggregate analytics only and does not sell data. Preserve the store's customer-consent requirements. The script independently requires `init.customerPrivacy.analyticsProcessingAllowed === true` and subscribes to consent changes.
5. Connect the custom pixel in Shopify. Open the actual storefront, grant analytics consent where requested, view a product and add it to cart. These are optional manual verification interactions; no checkout purchase or payment is required. Synthetic VM/PGlite tests do not populate the live database.
6. Open Northstar Shopify Sales. It refreshes visible status every five seconds. A received event changes the receiver status and fills event counts. The import worker is not involved in pixel ingestion.

The current HTTPS endpoint comes from `SHOPIFY_REDIRECT_URI`. Keep the application and ngrok tunnel available. If the public origin changes, regenerate and replace the pixel code. Local development is not an always-on production collector; offline or blocked events are lost. The pixel does not store a local retry queue or backfill historical behavior.

## Meaning and limits

- Counts represent browser-reported actions, not verified unique people, customers, live cart contents or a conversion funnel. Repeated actions can be legitimate distinct events. Add-to-cart quantity is separate from the number of add actions.
- Product IDs join event counts to catalog rows. Dates apply to event occurrence in the store timezone, independently of order creation dates. Browser events and server-side order imports have different coverage.
- The allowlisted payload contains only a public write key, event ID (stored as a source-scoped hash), event name/time, product ID and bounded quantity. Customer names, emails, addresses, raw visitor identifiers, URL/query strings, order details and full cart snapshots are not accepted. No browser cookies authorize the receiver.
- The write key is public browser configuration. It grants no reads, no administrative rights and no Shopify API access. Anyone who obtains it can potentially spoof browser events. Displayed counts must remain labeled browser-reported. Rotation and disabling the source stop old traffic; infrastructure-level abuse controls are needed for a large public deployment.
- The server accepts at most 2 KiB per request and 600 unique events per source per minute. Timestamps are limited to the last 24 hours and five minutes ahead. Event IDs deduplicate per source. Events older than 90 days are purged when a new event for that source is accepted.
- New event/source tables enable RLS. Runtime roles cannot insert/update/delete event rows directly. The fixed-search-path definer ingestion function resolves a hash capability, checks the connected Shopify store and the creator's current manager membership, and preserves caller tenant context. It does not turn a write key into a tenant read capability. All existing forced-RLS provider tables retain their protection.
- HTTP CORS deliberately permits sandboxed/opaque browser origins with credentials omitted. CORS is not treated as authentication. Keys never go in URLs. Request logging remains disabled.
- Disconnect the custom pixel in Shopify to stop this collector. A manager can also disable its source using tenant-authorized SQL; there is no dedicated source-management UI yet. No promise is made that the Shopify “Connected” toggle can be queried from Northstar.

## Validation

Unit/VM tests exercise consent grant/revocation, documented payload mapping and absence of identity fields. PGlite tests cover tenant reads, denied raw writes/viewer management, capability binding, caller-context preservation, duplication, disabling, rotation and rate limits. The public tunnel check uses an invalid empty payload and creates no customer events. Actual installation/consent delivery still requires the storefront verification above.

Official references:

- https://shopify.dev/docs/api/web-pixels-api/standard-api/customerprivacy
- https://shopify.dev/docs/api/web-pixels-api/standard-events/product_viewed
- https://shopify.dev/docs/api/web-pixels-api/standard-events/product_added_to_cart
- https://shopify.dev/docs/api/web-pixels-api/standard-events/checkout_started

General page views are supported separately via page_viewed (migration 010). Refresh the installed custom pixel from the local file after this upgrade; its existing write key is preserved. No page URL or query string is collected. Product views remain a distinct count, and historical page views are not backfilled.
