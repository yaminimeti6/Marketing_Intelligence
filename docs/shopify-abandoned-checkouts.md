# Abandoned-checkout reporting

Shopify Sales now has an Abandoned checkouts section with not-recovered and recovered counts, unrecovered checkout value grouped by currency, status filtering and paginated references. Dashboard dates filter checkout creation dates in the store timezone. Values are checkout snapshots, never lost revenue or actual sales.

The optional read-only import uses `abandonedCheckouts`, existing `read_orders` scope and Shopify's `manage_abandoned_checkouts` permission. It requests only ID, creation/update/completion dates and `totalPriceSet.shopMoney`. Customer identity, addresses, notes and recovery URLs are not requested or persisted. No recovery messages are sent.

Every store refresh attempts this import separately from order/product reads. All pages must validate before a creation-date window is atomically replaced. Recovered records update by source ID, successful empty responses remove old rows within the fetched window, and errors preserve old storage while the report hides stale totals. Missing permission or checkout endpoint failure is recorded in its own cursor and does not disable successful commerce imports. Refresh store data to retry optional checkout errors.

The fetched creation window is the store refresh's previous 59 days through request time. Older snapshot rows outside this window are not included in the current report. Source status can change after synchronization; there is no full history or live-cart guarantee. Existing runtime tenant policies and manager-only writes apply to the new forced-RLS table (migration 011).

Shopify considers a checkout abandoned when contact information is entered without completing the purchase; its endpoint includes both abandoned and recovered checkouts. Browser `checkout_started` events do not establish this classification. No payment, test purchase or contact-data submission is required to use this report, and no contact information was submitted during validation.

Validation: official schema validation for API 2026-10; 55 unit/database tests including pagination, exact currency arithmetic, recovered transitions, empty replacement, denied permission and tenant boundaries; local live read-only import successful with zero checkout records. Desktop/mobile checks cover empty state, date filters and recovered-status filter. No demo records are inserted into the live database.

Official sources:

- https://shopify.dev/docs/api/admin-graphql/latest/queries/abandonedCheckouts
- https://shopify.dev/docs/api/admin-graphql/latest/objects/AbandonedCheckout
