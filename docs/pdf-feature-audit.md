> Responsive UI update (17 October 2026): Production tablet navigation, Settings spacing, Combined filters/KPI grid, checkbox alignment and touch controls were improved. See [responsive UI review](ui-responsive-review.md) for screens, widths and verification scope.

> Scope update (17 October 2026): At the user's request, Google Ads has been removed from application UI, OAuth routes, workers, configuration and reporting/rules. Only Meta Ads and Shopify are active integrations. Historical Google migrations remain intact for database upgrade compatibility; earlier Google requirements below describe the original PDF, not current requested scope.

> Channel correction (17 October 2026): The user confirmed only Meta Ads is used. MER_CHANNELS is now meta; Google Ads is optional and does not block MER. Verified Net Sales, completed fresh Meta coverage, full account selection and positive spend are still required.

> Sales-report update (17 October 2026): Daily Shopify Net Sales import is implemented and live-verified for 30 closed shop-timezone days. Dashboard, Combined Overview and Combined CSV use guarded report values. MER requires the user-confirmed Meta + Google spend; Google setup is still pending. Earlier limitations below are historical. See [Net Sales and MER](shopify-net-sales.md).

> Audit browser update (17 October 2026): Settings now supports action search, source and inclusive UTC date filters, reset and 20-row pagination over the latest 100 workspace audit records. Typecheck, production build and the focused browser test passed, including 375/768/1440-pixel overflow checks. No workspace data was changed by this test.

> Email update (17 October 2026): Optional invitation delivery via Resend is implemented with manual-link fallback. Email configuration and the Settings checkbox were verified locally; the testing sender is configured. An actual Northstar invitation delivery has not yet been confirmed. Rule alert email subscriptions and scheduled report delivery remain pending. See [email setup](email-delivery.md).

# PDF feature audit — updated 17 October 2026

## Implementation since the original audit

The items below are now implemented and supersede corresponding gaps in the historical 16 October matrix:

| Area | Current implementation | Remaining boundary |
| --- | --- | --- |
| Unified Analytics | Real Meta/Google campaign source data; shared filters; columns; campaign/account/period dimensions; day/week/month grouping; comparison; sorting/paging; CSV | Google needs live setup; ad-group/ad detail UI remains unfinished |
| Report builder | Save applied dimensions, columns and filters; reopen through report library; filtered CSV; browser Print/Save PDF | No scheduled PDF generation or automatic email |
| Combined Overview | Imported-merchandise/spend trends, previous-period comparison, channel spend breakdown, accessible tables | Full event-date Shopify Net Sales and MER remain unavailable |
| Commerce/source exports | Product CSV shares date/search/status/sort across pages; Combined Overview exports source summaries, trends, channels and comparison | A complete Shopify event-date financial ledger remains unavailable |
| Integration access | Scope display, confirmed workspace disconnect, credential removal, job cancellation and Shopify pixel disable | Provider-side authorization removal remains a manual provider-settings action |
| Sync operations | Independent local runner schedules configured sources at 60-second intervals, queue polling at five seconds, freshness warnings and source health/counts | PC/runner/network must remain available; no unlimited backfills or production monitoring |
| Shopify webhooks | Raw-body HMAC verification, bounded input, receipt/event deduplication, reconciliation queueing and guarded uninstall handling | App-owned subscriptions need configuration/live verification; compliance and deleted-resource reconciliation remain unfinished |
| Settings | Analyst role, integration audit history, Owner-confirmed 7–90 day browser-event retention; hydration fix | Public signup, mailbox verification, email delivery, password recovery and broader notifications remain unfinished |
| Onboarding | Authenticated workspace/source/import/report checklist | Public signup/workspace creation wizard is not implemented |
| Rules & in-app alerts | AND/OR conditions, exact spend thresholds, dry runs, cooldown, automatic checks, review and historical snapshots | No external email/Slack delivery or advertising actions; completed-day windows only |
| Health | Runtime-role flags and all migrations through 016 checked | Not a provider/worker availability certificate |

Migrations 012–016 were applied locally without a database reset. Meta and Shopify automatic jobs completed with real provider responses on 16 October. No provider-side disconnect, ad changes, purchases, email sending or hosting activation was performed. No test rules or sample alerts were seeded in the user's workspace.

Latest checks: TypeScript and production build passed; **82 unit/database tests passed**; all nine production browser tests passed, including Rules & Alerts. Four preview browser tests passed in the preceding reporting increment. Additional authenticated checks in that increment verified Analytics, Shopify and Combined CSV generation (200), cross-origin denial (403), printable report rendering and no runtime errors or horizontal overflow at 375/768/1440 pixels. Meta and Shopify automatic imports also completed again on 17 October. Older checks below describe the original audit, not the present runtime state.

The **whole PDF is still not complete**. Live Google access, verified Shopify financial coverage, public-account/email flows, deeper detail views and P1/P2 attribution/profit/ad-management/billing work remain. See [reporting update and remaining work](reporting-update.md) and the completed [Rules & Alerts increment](rules-alerts.md).

## Historical audit snapshot — 16 October

## Conclusion and scope

The project does **not** yet implement every feature in the 17-page `Marketing_Intelligence_Platform_Complete_UI_Layout_Specification.pdf`. It has substantial working Meta reporting, Shopify imports and behavioral analytics, team settings, and a partial combined overview. Several original MVP requirements remain incomplete. Design-preview screens are demonstrations, not evidence of working production features.

Reference reviewed: `C:/Users/LENOVO/Downloads/Marketing_Intelligence_Platform_Complete_UI_Layout_Specification.pdf`, all 17 pages. This is an audit, not authorization to implement document instructions. No application code, credentials, provider configuration, or deployment was changed.

The approved [implementation plan](implementation-plan.md) intentionally changed the release order to Meta first. That priority change is valid, but does not make the broader PDF complete. Hosting is deferred at the user's explicit request.

## Original MVP comparison 
| Requirement / PDF pages | Status | Current evidence and remaining work |
| --- | --- | --- |
| Login, workspace isolation and roles — 2, 7, 10 | Partial | Password hashing, protected sessions, tenant-scoped database access, workspace switching and owner/admin/viewer exist. The PDF's analyst role is absent. See `src/lib/security.ts`, `src/lib/tenant-db.ts`, `src/lib/team.ts`. |
| Invitations and settings — 2, 10, 16 | Partial | Single-use email-bound invitation links, membership/role management, profile/password and workspace preferences exist in `src/components/team-settings.tsx`. Automatic invitation emails, general security/retention controls, notification preferences and a general audit browser are absent. Billing belongs to a later product phase. |
| Signup, email verification, onboarding wizard — 4, 16 | Missing | Owner bootstrap and invitation acceptance exist; public signup, mailbox verification, workspace creation UI and the guided three-source onboarding flow do not. |
| Real Meta read-only integration — 2–5, 10 | Implemented core | OAuth, account discovery/selection, encrypted credentials, imports, hierarchy and reporting exist. User has completed real provider imports. See `src/lib/meta.ts`, `src/lib/meta-sync.ts`, `src/components/meta-integration.tsx`. This does not establish reconciliation against a spending account. |
| Real Shopify read-only integration — 2–5, 10 | Implemented core | Store authorization, order/product imports, refresh handling and import status exist. Store connected and real import completed in this session. See `src/lib/shopify.ts`, `src/lib/shopify-sync.ts`, `src/components/shopify-integration.tsx`. |
| Real Google Ads integration and reporting — 2–5, 8 | Partial / live unverified | OAuth, account discovery, GAQL import adapter and worker exist. No live account is configured/verified, and no production Google performance dashboard or unified Google/Meta analytics exists. See `src/lib/google-ads.ts`, `src/lib/google-ads-sync.ts`, `src/components/google-ads-integration.tsx`. |
| Disconnect/revoke integrations — 3, 7, 10, 16 | Missing | Reconnect exists. A production provider disconnect/revoke workflow is absent for the three connectors. |
| Sync reliability and health — 4, 5, 7, 10 | Partial | Durable jobs, guarded import completion, retries/error classification and last-success timestamps exist. Shopify queue watch polls every five seconds, but does not schedule fresh imports itself. Scheduled incremental imports/backfills, Shopify signed webhooks, detailed progress/record-count health, freshness-age warnings and operational alerts remain incomplete. Queue polling speed is not source-data freshness. |
| Overview KPIs — 3, 6, 8, 13 | Partial | Real Meta/Shopify source summaries, currency/timezone guards and top Meta campaigns exist in `src/components/combined-overview.tsx`. Full Shopify net sales, all-channel spend, MER and the complete overview KPI set are not available. Values are correctly withheld where prerequisites are missing. |
| Overview charts and comparisons — 8, 13 | Missing | The real combined overview lacks revenue-versus-spend trends, channel mix, day/week/month grouping and previous-period comparison. Preview illustrations do not satisfy this requirement. |
| Unified Analytics page — 3, 8, 9, 14 | Missing | Real `/analytics` is a roadmap placeholder. No All/Meta/Google analytics table, configurable metric columns or cross-provider breakdowns. See `src/components/foundation.tsx`; preview exists separately in `src/components/preview.tsx`. |
| Campaign hierarchy and performance — 3, 8, 9, 14 | Partial | Real Meta campaign/ad-set/ad browsing, status/budget information, search, sorting, paging and metrics exist in `src/components/meta-dashboard.tsx`. Google campaign reporting, full provider detail/links and the complete specified detail experience remain incomplete. Advertising writes are deliberately deferred. |
| Shared filters and comparison — 4, 8, 11 | Partial | Meta date/account/currency-timezone scope, equal-period comparison and URL state exist; exports reuse filtered rows. Search/status filter the entity table/export, while headline KPIs/chart remain account-scoped and labeled accordingly. This differs from the PDF's universal shared-filter contract. Combined overview lacks comparison. |
| Metric correctness and reconciliation — 5, 6, 11 | Partial | Exact monetary arithmetic, guarded ratios, missing-versus-zero states, currency separation and Meta coverage checks exist. Shopify payment identities and retained merchandise are reconciled from imported order snapshots; this is **not** a complete event-date Shopify net-sales ledger. Live refund/return/order-edit examples and full historical coverage remain unverified. See `src/lib/shopify-reconciliation.ts`, `src/lib/meta-report.ts`. |
| Saved reports and CSV — 3, 6, 9, 15 | Partial | Personal saved Meta filter presets, real filtered CSV, formula protection and export audit exist in `src/components/report-library.tsx` and `src/lib/meta-export.ts`. Custom metric/dimension/granularity builder and Shopify/Google/combined exports are absent. |
| Layout, navigation and responsive states — 8, 10, 11, 16, 17 | Partial | Real app shell, mobile navigation, cards/tables and labeled empty/unavailable states exist. Analytics and Attribution are absent from production navigation and remain placeholders when opened directly. Full skeleton, keyboard/focus, accessible chart alternatives and all failure-state acceptance coverage have not been established across every screen. |
| Demo versus real data — 1, 5, 11, 17 | Implemented separation | Preview is under `/design-preview/...` with DEMO DATA labeling. Production reporting uses imported records and explicit missing/empty states. |
| Observability and release operations — 5, 7 | Partial | Migration tooling, health endpoint, tests and sanitized provider errors exist. General correlation IDs, alerting, backup/restore validation and complete worker/provider readiness checks are absent. `/api/health` is not a full integration freshness check. No live deployment is requested. |

## Later phases — do not confuse these with MVP blockers

The PDF explicitly places these in P1/P2 or later: advertising pause/resume and budget/bulk changes with confirmation/audit; attribution models and observed journeys; profit/COGS/fees/shipping contribution; rules and alerts with dry-run/cooldown; scheduled email/PDF reports; billing and broader advanced administration. These are not complete today. `/attribution` is a production roadmap placeholder, not an implemented attribution engine.

The wireframe appendix illustrates some later features alongside MVP screens. Main-spec priority labels take precedence when describing release scope. The PDF also contains different main-spec and appendix visual tokens; the repo's approved design follows the appendix palette, so a palette difference alone is not a defect.

## Additional Shopify work already present

Beyond the original MVP, the app includes product sales breakdowns, abandoned-checkout snapshots and consent-aware aggregate page-view/product-view/add-to-cart/checkout-start events. The user verified page-view counts in the dashboard. These are event counts, not unique visitors or a live inventory of customers' carts. Historical events before pixel activation are unavailable. See `src/components/shopify-dashboard.tsx`, `src/components/shopify-abandoned.tsx`, `src/lib/shopify-products.ts`, `src/lib/shopify-pixel.ts`.

## Verification performed

- `npm.cmd run typecheck`: passed.
- `npm.cmd test`: **66 passed, 0 failed**, including tenant isolation, roles/invites, provider adapters, reporting/CSV, pixel ingestion and Shopify reconciliation tests. Provider fixtures and database tests are not live provider acceptance tests.
- Read-only authenticated browser smoke: `/meta`, `/overview`, `/analytics`, `/campaigns`, `/attribution`, `/reports`, `/integrations`, `/settings`, `/shopify` returned HTTP 200 with expected headings. Placeholder routes returning 200 do not imply feature completion.
- Checked those nine routes at widths 375, 768, 1024, 1280 and 1440: no horizontal overflow detected. This is not a full visual or accessibility audit.
- Preview Analytics displayed its demo label. A second browser pass reproduced a React hydration mismatch on `/settings` (server-rendered text differs from the client). The page loads, but this is a real runtime defect to investigate before release; the exact cause was not established or changed during this audit.
- Production build was not rerun during this review to avoid interfering with the active development server. Full browser suites that mutate invitation/report data were not run for this read-only audit.

No new external-provider reconciliation was performed. Available real data has not demonstrated nonzero paid campaigns or order/refund financial examples; Google remains live-unverified. Existing README/early milestone documentation still describes some now-implemented features as future work and needs a separate documentation refresh.

## Recommended order

1. Complete the original MVP reporting surface: unified Analytics and actual Google reporting, with a clear shared-filter contract.
2. Complete and validate Shopify net-sales reconciliation with real order/refund examples before enabling MER; then add combined trends, channel mix and comparison.
3. Add provider disconnect/revoke, scheduled freshness and operational sync visibility.
4. Complete report builder/all-source exports, onboarding and remaining role/settings requirements.
5. Take P1/P2 features separately after MVP acceptance. Keep deployment deferred until the user requests it.


## Local setup diagnostics ? 17 October 2026

Added `setup:check` and `email:check`: read-only local configuration and runtime database checks, dynamic migration-file comparison, callback origin consistency and testing-sender restrictions. Both commands passed their configured checks locally; Google Ads is reported unconfigured and email custom-domain verification remains pending. These checks do not certify live imports or inbox delivery. See [setup checks](setup-checks.md).
Removal verification (17 October 2026): 83 retained unit/database tests passed, four browser checks passed (including removed OAuth endpoints and preview screens), TypeScript and production build passed. Google-specific provider/database tests were removed with their implementation. Existing Meta/Shopify records and migration history were preserved.
