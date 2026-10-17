# Meta performance dashboard

Implemented on `/meta` and `/campaigns`. These routes read workspace-scoped imported Meta records; they never use design-preview fixtures or make provider calls during page rendering. Shopify remains disabled.

## Available reporting

- Account, currency/reporting-timezone scope, inclusive date range (maximum 366 days), optional previous equal period.
- Spend, Meta purchase-attributed value, purchases, ROAS, impressions, unique reach, all clicks, CTR, CPC, CPM and purchase CPA.
- Daily spend/value trend and accessible data table; searchable status-filtered campaign ? ad set ? ad drilldown, budgets, sorting and pagination.
- Completed sync coverage and freshness. Unknown coverage shows unavailable values; successful empty provider responses yield zero additive metrics and unavailable ratios.
- Report sync requests queue real read-only provider jobs. The local worker processes one job per workspace per pass; comparison periods may require an additional pass. Refresh after processing.

## Metric rules

Totals use campaign-level daily facts exactly once. Entity rows use their own level. Currency amounts are added with fixed-point integer arithmetic, then formatted; ratios and chart coordinates use floating point. Ratios use summed numerators/denominators and are unavailable for zero denominators. Purchase aliases choose omni_purchase, purchase, then website pixel purchase once per source row. Meta attributed value is not Shopify sales.

Currencies and reporting timezones are never combined into a single scope. Budgets convert Meta minor units using currency decimal places. Reach is never summed across days or accounts. Migration 003 adds exact-range source summaries; unique reach requires an actual matching range response from Meta. Missing summary rows remain unavailable.

A queued, running or failed overlapping refresh hides affected aggregate results until successful completion. This avoids exposing partially refreshed facts as completed reporting. A failed or incomplete comparison period never produces a comparison percentage.

## Local activation

1. Run `npm.cmd run db:migrate` to apply the additive 003 migration; no reset.
2. Open `/meta`, apply the desired dates/account and choose Sync selected range.
3. Run `npm.cmd run worker` until requested jobs finish, then refresh. No payment method, campaign creation or ad spend is required. Empty real source results are valid.

## Validation and limits

TypeScript and production build pass. Twenty unit/database tests cover metric math, date boundaries, missing/empty distinctions, tenant RLS, source sync idempotency and summary refreshes. Browser coverage checks authenticated reporting, responsive widths and existing preview routes.

The new exact-range API request is tested with isolated fixtures, not with a nonzero live ad account. This implementation does not claim verification of nonzero spend/purchase reporting. No production demo records are inserted. Migration 003 and subsequent live range import are separate activation steps.

Browser verification: all 8 Playwright tests passed, including authenticated Meta reporting and widths 375/768/1024/1440. The connected INR account was visible in the local reporting UI; the default requested period lacked complete coverage and correctly showed unavailable metrics. No live provider sync or migration 003 was executed during these checks.
