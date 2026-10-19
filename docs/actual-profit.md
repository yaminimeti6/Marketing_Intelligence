# Actual Profit Analytics

Open `/profit-analytics`. Choose a store and an exact range (at most 91 days). The default is the prior 30 completed store-local days.

The report combines fresh, dense ShopifyQL event-date Net Sales with covered Meta spend from all accessible matching-currency/timezone accounts. MER_CHANNELS must confirm Meta as the only paid channel. It does not substitute attributed Meta revenue or order snapshots for Shopify Net Sales. Missing or stale imports remain unavailable; a running worker is required for fresh data on Netlify.

Owners/admins record complete actual period costs from supplier, accounting and settlement records: net COGS, shipping/fulfilment, payment/platform fees, other expenses and allocated overhead. No estimates or sample costs are seeded. Every field requires an explicit value; enter zero only when confirmed. Documented recoveries can be negative. Use net shipping expense after customer shipping receipts because Net Sales excludes shipping revenue. Exclude recoverable taxes and do not deduct sales refunds twice.

Costs are stored per workspace, store and exact period, with currency/timezone, latest editor/time and an audit event. Saving replaces that period's record. Overlapping periods are independent, never summed or prorated. Changing a range requires its own confirmed costs. This is period-level manual actual-cost capture, not automatic supplier invoice, SKU inventory valuation or settlement reconciliation.

Gross profit = Net Sales - COGS. Contribution also deducts shipping, fees, other expenses and Meta advertising. Operating profit also deducts allocated overhead. Margin is unavailable for zero/negative Net Sales. Results are before interest and income tax, and depend on the completeness of the costs entered; they are not audited net profit. Fixed-point arithmetic preserves six decimal places without floating-point money calculations.

Migration 020 creates tenant-isolated cost storage. Owners/admins can write; members can read; anonymous access is denied. No advertising or payment API mutation occurs.
