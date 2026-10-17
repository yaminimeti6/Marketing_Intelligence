# Shopify imported totals and faster updates

The Shopify Sales page reads tenant-scoped imported order/product snapshots after the latest job succeeds. During queued/running/failed imports, totals are hidden to avoid presenting partial pages. Values use exact six-decimal integer arithmetic and currencies remain separate. Missing money is unavailable, never zero.

The dashboard now includes store status, compact import timestamps, order-creation date filters in the store timezone, four summary cards, a top-products quantity chart, and a searchable/filterable/paginated product table. Filters operate on imported records; they do not imply full historical coverage. An empty completed import can show zero orders and units within this dataset, while cart metrics remain unavailable.

Order imports include every paginated line item. The first nested page is deliberately small to keep Shopify query cost bounded; subsequent line pages use fixed order IDs and reject an order whose `updatedAt` changed mid-pagination. Detail-version markers and `lineItemsComplete` distinguish upgraded imports from legacy rows. Legacy rows hide product totals until reimported. Null/deleted products retain an order-item identity rather than merging unrelated products by title.

Units ordered use `quantity`; units retained use `currentQuantity` (excluding refunded and removed units). Item subtotals use `priceAfterAllDiscountsBeforeTaxesSet.shopMoney`, without applying another refund subtraction. Product-level order counts deduplicate an order with multiple variants of the same product. This is product order activity, not proof of payment or delivery. Product money stays separated by currency.

The custom-pixel receiver is now implemented; see [customer-event setup](shopify-customer-events.md). Until installation and real event receipt, the page marks shopper metrics as pending. No tracking scripts have been installed automatically on the storefront, and no visitor identity or live-cart claim is made. Order records cannot reconstruct historical cart activity. An add-to-cart action does not establish that a cart still contains an item. Setup respects the merchant's analytics-consent settings.

The current order subtotal is a sum of Shopify `currentSubtotalPriceSet.shopMoney.amount`. Refund amounts use `totalRefundedSet`, displayed separately, never deducted a second time. Test/cancelled orders are excluded. An empty result does not imply a known zero monetary total. Presentment/shop currency mismatches withhold money rather than mix currencies.

These are accumulated imported snapshots with their latest updated-at import window displayed, not a complete sales-date ledger or Shopify Analytics Net Sales. Provider history limits apply. Refund dates, deleted records, complete sales accounting, payments and profit reconciliation remain future work. Product counts are imported snapshots and may include subsequently deleted products.

Run `npm.cmd run worker:shopify:watch` in a terminal to process queued jobs continuously, checking every five seconds between completed passes. Ctrl+C stops it. The existing `worker:shopify` command remains one pass. The watcher does not create imports automatically or change storefront data. Avoid running multiple watchers unnecessarily; database leases protect claims.

Transient unavailable errors retry after 5, 10, 20 and 40 seconds (maximum five attempts). Throttling retains a slower 30, 60, 120 and 240 second backoff. API/network/page processing time is additional; completion within five seconds is not guaranteed. Integration and Shopify Sales pages refresh pending job status every five seconds while visible, pausing polling when hidden and stopping after completion/failure. Queuing and running an import remain distinct operations.

Sources:

- https://shopify.dev/docs/api/admin-graphql/latest/objects/Order
- https://shopify.dev/docs/api/admin-graphql/latest/objects/LineItem
- https://shopify.dev/docs/api/web-pixels-api/standard-events/product_added_to_cart
- https://shopify.dev/docs/apps/build/marketing/pixels
