# Combined Overview

`/overview` now compares tenant-scoped Meta reporting and Shopify imported financial snapshots. It replaces the foundation placeholder and performs no provider requests itself.

The page includes a shared date range, Meta currency/timezone and account selectors, a Shopify store selector, source summary cards, Meta-attributed revenue/purchases/ROAS, Shopify refunds and order counts, sync timestamps, and leading Meta campaigns. Detail links preserve the applied dates. A changed Meta scope resets the account selector to all accounts in that scope.

The server first normalizes the Meta query, then passes the same start/end to the Shopify loader as its order-creation date filters. Meta's reporting dates and Shopify's order-cohort semantics remain explicitly distinct. Meta spend/revenue sums campaign-level facts only, preserving existing completed-coverage checks. Missing account sync timestamps remain unknown rather than suggesting a fully synchronized group.

Shopify merchandise uses the reconciliation module's retained non-gift-card item subtotal; net payments and refunds include cancelled non-test orders. Values are limited to the selected store and its shop currency, with foreign-currency groups withheld rather than converted. Pending/legacy/failed financial imports or mismatched date ranges do not substitute zeros. A completed empty imported cohort can show zero, clearly labeled imported data.

Meta-attributed revenue and Shopify amounts are never added together. Different currency/timezone scopes display a warning and do not generate a combined ratio. **Blended MER remains unavailable**: current Shopify imports do not establish complete sales-date coverage, and all marketing-channel spend is not imported. It is not relabeled Meta ROAS or calculated from partial datasets. Full Shopify event-date sales accounting and marketing spend coverage are prerequisites for that ratio.

Validation: TypeScript and all 66 unit/database tests pass. Five combined-report tests cover hierarchy deduplication, attribution separation, pending coverage, date mismatch, currency/timezone mismatch, unknown stores, completed empty versus missing data and unknown account timestamps. Live authenticated browser checks cover the real source cards, shared date submission, date-preserving detail links and layouts at 375/768/1440 pixels, without runtime errors or horizontal page overflow. No demo data or provider writes were used.
