# Marketing Intelligence Platform — Meta-first implementation plan

Status: approved October 15, 2026. Foundation and Meta Access (originally numbered 0 below) was completed as user-facing Milestone 1. The user has now authorized Milestone 2: Meta connection and ingestion (originally numbered 1 below). See milestone-1.md for completed verification and milestone-2.md for active implementation/setup boundaries. Shopify and future phases remain planned.

## Product priorities and release boundaries

1. Meta Ads is the core product and first production release. It must work independently of Shopify.
2. Shopify supplies actual commerce records and store revenue after Meta reporting is reliable.
3. A combined dashboard follows both verified integrations.

Initial campaign, ad set, and ad management means browsing the real hierarchy, inspecting configuration, status, budget and performance, and filtering/comparing results. Campaign creation, pause/resume, budget changes and bulk mutations remain later phases. There will be no initial write permissions or controls claiming to execute those actions.

The existing preview remains explicitly labeled DEMO DATA until connected production views replace fixtures. Production dashboards never fall back to synthetic records. Missing permissions, unavailable metrics, empty results, failed syncs and disconnected accounts each have honest states.

## Preserve the professional UI/UX

Keep the existing Next.js App Router, TypeScript, Tailwind and Recharts frontend and documented design: #F5F7FB background, #101C32 navigation/headings, #3568E8 primary, #159B76 positive, #F2A34B warning, #DFE5EE borders, 240px sidebar, 72px header, 8px spacing baseline and 12px modal radius. Preserve responsive navigation, mobile campaign cards, accessible tables/tooltips, date controls, comparisons, sorting, pagination and exports.

Make Meta Ads the primary landing experience and first navigation destination. Retain Shopify Sales, Combined Overview, Integrations and Settings. Keep reports, attribution and other future surfaces on the roadmap with explicit availability labels. Preserve the UI specifications in README.md and docs/ui-preview.md; the original referenced 17-page specification is not present in this workspace, so it must be checked before any additional design changes.

## Architecture

- Next.js frontend and server API layer: authenticated, workspace-scoped requests; no provider tokens in the browser or browser storage.
- PostgreSQL: workspace identity, provider configuration, normalized source records, reporting facts, sync metadata and audit events. Enforce tenant isolation on every query, job and resource reference, backed by database policies where applicable.
- Separate background worker and durable queue: independent Meta and Shopify queues, prioritizing Meta; scheduled/incremental imports, historical backfills, retries, rate-limit handling and reconciliation. A Shopify failure must not block Meta dashboards.
- Provider adapters: Meta Marketing API first, Shopify GraphQL Admin API second. Pin supported API versions during implementation and plan upgrades. Provider-specific ingestion stays separate from shared reporting calculations.
- Security: workspace roles, server-side OAuth callbacks with state validation, encrypted token storage using managed keys, minimum required scopes, expiry/revocation detection, reauthorization, secret redaction and access audit trails. Handle token renewal according to each provider's supported lifecycle; do not assume generic refresh tokens.
- Operations: job visibility, structured logs without secrets/customer payloads, alerts, connection health, last successful sync, data coverage and partial-result indicators. Signed Shopify webhook verification and deduplication supplement reconciliation polling.

Production setup requires real developer applications, credentials, valid redirect domains, accessible test accounts/stores and applicable provider approvals. Meta permission and business verification requirements are an early feasibility gate, not a promise of immediate approval. Start with reporting access; request advertising write access only in the later mutation phase.

## Database design

| Group | Planned entities and purpose |
| --- | --- |
| Workspace | workspaces, users, memberships, roles; tenant ownership and access |
| Connections | provider_connections, encrypted_credentials, account_store_links; scopes, lifecycle and explicit reporting mappings |
| Meta hierarchy | meta_ad_accounts, meta_campaigns, meta_ad_sets, meta_ads; provider IDs, parent links, names, configured/effective status, currency/timezone and budget configuration |
| Meta performance | meta_insight_facts and meta_action_facts; account/entity/date, reporting level, attribution settings, action type, spend, impressions, clicks, source reach, conversion counts and values |
| Shopify commerce | shopify_stores, products, variants, orders, order_lines, refunds, refund_lines, sales_adjustments; source timestamps, statuses, amounts, currency and original source IDs |
| Reporting | shopify_daily_sales, reporting_preferences, metric_definitions and optional fx_rates; reproducible revenue calculations and explicit scope/currency policies |
| Reliability | sync_jobs, sync_cursors, sync_runs, webhook_receipts, reconciliation_results, audit_events; checkpoints, retries, deduplication and traceability |

Every provider entity is unique within its workspace and source account/store. Meta fact uniqueness includes entity level, period, attribution configuration, action type and any breakdown dimensions. Keep report-level totals separate from lower-level facts to prevent double counting. Use decimal or integer minor-unit monetary values, never floating point money. Record source currency, timezone, API version, ingestion time and coverage. Avoid collecting customer PII unless a documented requirement needs it.

Store budgets with level, type (daily/lifetime), currency and effective dates; an ad set can inherit campaign budgeting. Preserve hierarchy and historical configuration where necessary. Raw provider responses may be retained with restricted access and bounded retention for reconciliation, excluding secrets.

## Metric and reporting contract

- Meta dashboard: spend, impressions, reach, clicks, CTR, CPC, CPM, CPA, conversions and ROAS; campaign/ad set/ad drilldown, configuration, status, budget, time series and previous-period comparison. Specify click and conversion action definitions in labels/tooltips.
- Compute CTR, CPC, CPM, CPA and ROAS from compatible aggregate numerators and denominators; never average row ratios. Show N/A for zero denominators or unavailable values. Reach is non-additive: obtain matching account/entity and full-period totals from Meta rather than summing daily or campaign reach.
- Keep Meta purchase-attributed revenue and conversion action types separate from other conversion values. Record attribution window and reporting-time settings; comparisons require consistent settings. Meta ROAS = selected Meta purchase-attributed revenue / selected Meta spend.
- Shopify Net Sales = gross merchandise sales minus discounts and merchandise returns, excluding tax and shipping. Document treatment of cancellations, test orders, edits, gift cards and refund timing; retain components rather than subtracting full refunds indiscriminately. Orders and refunds are different business events. Validate definitions and reporting-date behavior against Shopify reports with real examples.
- Blended MER = Shopify Net Sales / Meta ad spend for the explicitly mapped stores/accounts and selected period. Label it as using Meta spend only until other channels exist; do not imply it includes all marketing costs. It measures an overall relationship, not causal attribution.
- Never add Meta attributed revenue to Shopify revenue or claim order-level reconciliation without independent attribution. Shopify revenue stays scoped to selected stores; filtering campaigns changes advertising metrics and MER denominator, not actual store sales. Display the active scope prominently.
- Do not total incompatible currencies. Initially group/report compatible currencies separately; add explicit exchange-rate source, date and conversion policy before enabling converted totals. Show source timezones and common reporting-day policy; daily aggregates cannot simply be relabeled into another timezone. Block or explain incompatible comparisons until compatible data is available.
- Each view/export shows source, currency, date range, account/store scope, attribution settings where relevant, freshness and incomplete coverage. Late conversions and refunds require reimports and may revise prior periods.

## Development milestones and acceptance gates

| Milestone | Scope | Approval-ready completion evidence |
| --- | --- | --- |
| 0 — Foundation and access | Confirm existing UI, reporting definitions, Meta app setup/permissions, workspace auth/RBAC, schema, secret storage and queues | Tenant isolation and token handling verified; real Meta account accessible; no fake connection success |
| 1 — Meta connection and ingestion | OAuth, multiple ad accounts, hierarchy/status/budget import, historical backfill and incremental Insights sync | Connect two authorized accounts; inspect real campaign/ad set/ad records; reauthorization and retry paths work without duplicate facts |
| 2 — Meta-first production release | Meta dashboard, all requested metrics, date/account filters, period comparison, campaign charts/table and drilldowns | Reconcile representative periods against Ads Manager using matching attribution/timezone settings; explain any differences; prove freshness/partial/error states |
| 3 — Shopify integration and sales | Real store authorization, GraphQL orders/products/refunds imports, Shopify sales dashboard, backfill, webhooks and reconciliation | Reconcile sales/order/refund examples to Shopify; prove idempotency, delayed refunds and reconnect behavior; historical coverage is explicit |
| 4 — Combined dashboard | Total Meta Ad Spend, Shopify Net Sales, Orders, Blended MER, Meta ROAS, Revenue vs Ad Spend chart, campaign performance table, account/store/date filters | Verify formulas, explicit account/store mappings, currency/date compatibility and distinct source revenue labels; no revenue double counting |
| 5 — Production hardening | Load/rate-limit validation, recovery, monitoring, retention, security review and deployment | Repeated jobs remain idempotent; cross-tenant access denied; revoked tokens handled; backup/restore and deployment checks pass |

Security and data correctness are required throughout; milestone 5 completes operational readiness. Shopify development follows the accepted Meta reporting release. Timelines depend on actual provider access, data volume and approvals and should be estimated after milestone 0.

Sync design: resumable paginated/bulk historical imports where supported; incremental cursors with overlap; deterministic upserts; per-account/store concurrency limits; exponential backoff; dead-letter handling; webhook deduplication; periodic source reconciliation. Refresh recent Meta attribution periods and older requested ranges as appropriate; Shopify updated-order imports must also capture refunds on older orders. Show actual imported coverage rather than implying unlimited history.

## Later roadmap — retained

1. Campaign pause/resume and budget editing, with additional permissions, confirmation, audit records and provider-verified results.
2. Bulk campaign management and automation rules, with limits, safe retries and execution history.
3. Profit analytics using explicit product costs, fees, shipping, refunds and currency policies.
4. Advanced reporting, saved reports, scheduling, PDF exports and richer breakdowns.
5. AI recommendations and creative analysis based on verified data and clearly stated evidence.
6. Independent attribution: consent-aware tracking, identity resolution, deduplication and documented models; separate from Meta attribution.
7. Google Ads and other advertising platforms through separate adapters, without reducing Meta's primary role.

Existing settings, team, billing and notification concepts remain in the product backlog and require their own production implementation.

## Documentation references and verification limits

- Meta Insights: https://developers.facebook.com/docs/marketing-api/insights/
- Meta authorization: https://developers.facebook.com/docs/marketing-api/get-started/authorization/
- Shopify Order and historical access: https://shopify.dev/docs/api/admin-graphql/latest/objects/order
- Shopify bulk imports: https://shopify.dev/docs/api/usage/bulk-operations/queries

Shopify's Order documentation notes limited default historical access and additional access requirements for older orders. Confirm permitted history for the chosen app distribution model. Meta documentation returned HTTP 429 during this planning review, and the Shopify skill search could not connect; exact scopes, supported fields, limits and API versions remain implementation-time verification gates against official documentation. No live integration is claimed.

Approval requested: approve the Meta-first scope, architecture/database proposal and milestone order before implementation begins.

Shopify connection/import foundation authorized and implemented October 16, 2026: see [shopify-setup.md](shopify-setup.md) for exact scope and live setup dependencies. The earlier Shopify-out-of-scope wording records the prior Meta-only authorization; the newer explicit request supersedes it. Shopify sales reconciliation and combined reporting remain pending.

Google Ads connection/import foundation authorized October 16, 2026; this increment was later removed at the user's request on 17 October 2026. This supersedes the earlier future-only status for the connector source. OAuth/developer-token/account setup and live reconciliation remain pending; Google dashboards and combined reporting are not claimed complete. Meta remains the primary working source.

Team invitations, Owner/Admin/Viewer settings UI, profile/password updates and workspace switching implemented October 16, 2026. See [team-settings.md](team-settings.md) for permissions, manual-link delivery, private authentication-table boundaries and remaining production identity/email requirements. Native migration 007 applied without reset; 41 tests, 11 browser checks and build/TypeScript pass.
