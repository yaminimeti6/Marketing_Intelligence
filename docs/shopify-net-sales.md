# Shopify Net Sales and MER

The Shopify worker imports aggregate daily `net_sales` for the preceding 30 closed days in the shop timezone. A real read-only ShopifyQL query returned all 30 days on 17 October 2026, and the report checkpoint was saved successfully. Shopify and Combined Overview display the report value; Combined CSV includes it separately from snapshot merchandise and payments.

Net Sales uses Shopify sales-event dates, including sales reversals, and excludes taxes, shipping, duties and fees. Current order snapshots are not substituted for this report. The current day is excluded. Select dates inside the imported report window; the unfiltered Shopify page labels the report's own range.

Missing dates, duplicate dates, invalid amounts, parse errors, failed imports, mismatched currency/timezone, out-of-range dates and reports older than 15 minutes withhold the value. A report failure does not disable order/product imports. Worker scheduling and network access must remain available; this change does not deploy the app.

The user corrected their paid-channel declaration: only Meta Ads is used. `MER_CHANNELS=meta` is configured privately. MER needs verified Net Sales and complete, fresh Meta reporting, matching dates/currency/timezone, full account selection and positive total spend. Google Ads was removed at the user's request. MER still remains unavailable if Meta spend is zero or required source coverage is missing. All marketing accounts must be connected; additional channels require revisiting this coverage declaration.

There are currently no imported order/refund examples. Report access and parser validation succeeded, but representative live order/refund reconciliation has not been demonstrated. No test purchases, refunds or advertising changes were made. Existing trend and previous-period merchandise comparisons remain snapshot-based; they are not Net Sales trends. Longer periods and intraday reporting remain future work.

Run `npm.cmd run shopify:reconcile` for read-only tenant-scoped report and payment readiness checks. It does not display secrets or customer/order details.

References: [Shopify sales schema](https://shopify.dev/docs/api/shopifyql/latest/schemas/sales_revenue/sales), [ShopifyQL permissions](https://shopify.dev/docs/api/admin-graphql/latest/queries/shopifyqlQuery).
