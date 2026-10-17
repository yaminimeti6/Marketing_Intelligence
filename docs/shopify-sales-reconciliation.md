# Sales reconciliation

Shopify Sales now includes imported-order financial breakdowns and an exact payment identity check. This is a snapshot reconciliation, not an event-date Shopify Analytics Net Sales ledger or bank settlement reconciliation.

## Calculation

- Per order, expected net payment = `totalReceivedSet.shopMoney.amount` − `totalRefundedSet.shopMoney.amount`. Difference = Shopify `netPaymentSet.shopMoney.amount` − expected net payment. Exact zero means **payment identity matched**, a nonzero difference requires review, and missing/mixed-currency source amounts mean incomplete.
- Retained merchandise subtotal is the sum of `priceAfterAllDiscountsBeforeTaxesSet.shopMoney.amount` for non-cancelled, non-gift-card order lines. Refunds are not subtracted a second time. This subtotal is distinct from current order totals, which can include other charges.
- For tax-exclusive orders, retained gross item value = `originalUnitPriceSet.shopMoney.amount` × `currentQuantity`; retained item discounts = retained gross item value − retained merchandise subtotal. `currentQuantity` already excludes removed/refunded units. This is retained value, not original gross sales or a dated returns ledger. Tax-inclusive or unknown-tax-mode original values/derived discounts are withheld to avoid mislabeling tax as a discount.
- Current order discounts are Shopify `currentTotalDiscountsSet`, displayed separately rather than deducted from already discounted item values.
- Current tax, current shipping, original/current order totals, shipping refunds and outstanding balances are independent source amounts. Tax-inclusive shipping is not added to tax to infer another order total. No estimated fees, duties, tips, payment fees, FX or profit are introduced.
- Cancelled non-test orders remain in payment/refund totals. Their retained merchandise is excluded. Test orders and invalid creation dates are excluded. Financial status and outstanding balances distinguish COD/unpaid source data from receipts.

All sums use signed integer micro-units with six decimal places, retaining large values without JavaScript floating point conversion. Groups use the money fields' **shop currency**, not the customer's presentment currency. Missing values withhold the affected aggregate; currencies never mix.

## Coverage and storage

The existing encrypted authorization and tenant-scoped `shopify_records` store are reused; no new credentials or financial tables are required. The importer fetches the additional fields and sets `financialVersion: 1` only with the completed import checkpoint. Pending/failed/legacy imports do not claim completed reconciliation. Fully paginated order lines are required for item totals. The first orders page is reduced to five orders to bound nested query cost; exhaustion of existing page limits fails rather than silently truncating.

The UI shares the store timezone and order-creation date filters, supports payment-status filtering/pagination, and explains each calculation. Refund amounts are lifetime totals for the selected order cohort, not refund activity occurring during the selected dates. Provider history restrictions and older imported snapshots remain visible limitations. Payment identity matching does not verify fulfillment, gateway settlement or profitability. Full sales-agreement/event-date reconciliation remains future work.

## Verification

The generated orders/line-item queries validate against Shopify Admin GraphQL 2026-10. TypeScript passes. The 61-test suite covers partial refunds, discount handling, cancellation, gift-card exclusion, unpaid/COD, tax-inclusive gross withholding, negative net payments, exact small differences, currency mismatches, large monetary values, dates and legacy/empty imports. The final tax-inclusive adjustment was rechecked with the six focused reconciliation tests.

The connected store's upgraded read-only import completed successfully with zero imported orders, so no real monetary order match is claimed. The live UI correctly shows “No eligible imported orders to reconcile.” Populated examples exist only in isolated automated tests, never in the live database.

Source: https://shopify.dev/docs/api/admin-graphql/latest/objects/Order

Line-item source: https://shopify.dev/docs/api/admin-graphql/latest/objects/LineItem
