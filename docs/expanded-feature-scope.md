# Expanded feature scope - 19 October 2026

This is the current audit of the user's supplied feature requirements, based on repository implementation and read-only setup checks. Vendor feature lists are requirements supplied by the user, not independently verified vendor claims. Current marketing scope is Meta Ads plus Shopify; Google Ads was explicitly removed.

The latest implementation verification completed 127 unit/database tests, production build and responsive checks at 375/768/1440 pixels. Creative Library also passed real temporary upload/download, private media, archive/restore, WebM playback and mocked AI-save checks; temporary assets were deleted. These checks do not establish live provider delivery, installed storefront tracking or financially representative acceptance.

## Implemented capabilities

| Area | Implemented behavior | Remaining boundary |
| --- | --- | --- |
| Dashboards, multi-account reporting | Meta account discovery, account/currency/timezone scopes, imported Meta/Shopify dashboards and source coverage checks | Fresh imports require a running external worker. |
| Custom Dashboard | Saved workspace layouts, KPI/chart/table widgets, ordering, widths, source selectors, revision conflict checks and responsive columns | No custom formulas or public sharing. See [Custom Dashboard](custom-dashboard.md). |
| Reporting | Filters, saved configurations, campaign/account/period dimensions, CSV and browser print | Browser print is not scheduled PDF generation. |
| Scheduled Reports | Daily/weekly/monthly Meta campaign snapshots, private CSV history and member email notifications | Requires active worker and verified email sender; no Shopify/profit scheduling or inbox-delivery proof. See [Scheduled Reports](scheduled-reports.md). |
| Team management | Roles, invitations, memberships, audit and workspace settings | Invitation inbox delivery needs live verification. |
| Rules, alerts, automation | Rule evaluation, dry runs, cooldown and in-app alerts | No automatic advertising optimization or rule-alert email subscriptions. |
| Shopify sales, revenue, products and MER | Order/product imports, reconciliation, event-date ShopifyQL Net Sales and guarded Meta-only MER | Representative paid/refunded orders and fresh complete coverage are required. |
| Actual Profit Analytics | Saved actual period costs joined with guarded Net Sales and Meta spend; gross/contribution/operating results | Costs are manually recorded actuals. No automatic dated SKU COGS, supplier invoices, settlement reconciliation or audited net profit. See [Actual Profit](actual-profit.md). |
| Profit Planner | Manual scenario calculator and local CSV | Separate from recorded actuals and source reporting. |
| Creative Insights and fatigue | Ad-level comparison, coverage guards, exact-range frequency and bounded CTR/CPA fatigue signals | Observational signals; no causal winner or creative-asset deduplication. |
| Creative Library | Private image/video uploads, thumbnails, tags/search, notes, preview/download, archive/restore and confirmed deletion | No Meta media import or asset-to-performance mapping. See [Creative Library](creative-library.md). |
| AI Co-Pilot and Copywriter | Aggregate Meta questions and reviewed copy drafts in English, Gujarati and Hindi | Requires OpenAI API credits/model access. No automatic publishing or actions. |
| AI image generation | Image generation, JPEG download and explicit save to Creative Library | Requires paid API credits/model access; no video-generation provider configured. |
| First-party pixel and journeys | Aggregate browser events plus opt-in consent-based pseudonymous page/checkout events and observed journeys | Pixel installation and real event delivery remain unverified. No automatic cross-device identity. |
| Attribution and cohorts | Order-count first/last/linear attribution, unmatched-order bucket and first-retained-observed purchase cohorts | Not financial revenue attribution, verified acquisition cohorts, full-history LTV or causal impact. |
| A/B experiments | Registered randomized storefront headline/CTA and same-store landing-path tests, assignment snippet, lifecycle and mature conversion intervals | Manual theme/pixel installation and real traffic needed. Meta-side experiments, automated significance/winner decisions and sequential stopping guarantees remain pending. See [Journeys and Experiments](journeys-experiments.md). |
| Campaign Actions / bulk actions | Paused campaign containers; reviewed ACTIVE/PAUSED and daily-budget changes for up to five imported objects | Execution opt-in and ads_management required. No full ad-set/creative/ad launcher; unknown-outcome reconciliation remains manual. See [Campaign Actions](campaign-actions.md). |

## Still not implemented

- Full bulk campaign launch with targeting, ad sets, creative selection, ad creation and reviewed publication.
- Funnel/landing-page builder and publishing. Existing experiments switch supplied text/paths; they do not build landing pages.
- Competitor/industry ad research backed by an authorized dataset.
- AI video generation and Video Sage/video analysis; autonomous AI Marketer actions.
- Consent-aware Meta Conversions API delivery, server/browser event deduplication and verified event matching. Pixel ingestion is not CAPI.
- Verified revenue attribution, customer segmentation, full-history retention/LTV and cross-device customer journeys.
- Automatic historical SKU cost valuation, supplier/settlement imports and full accounting reconciliation.
- External data-warehouse connectors and governed warehouse exports.
- Marketing/media mix modeling, incrementality measurement and validated causal budget-allocation models. Sparse single-channel data does not establish these results.
- Scheduled PDF, public report sharing and custom dashboard formula editor.

## Read-only readiness check - 19 October 2026

Local and hosted-target setup checks passed: Meta/Shopify configuration presence, callback-origin consistency, restricted database role and all 23 migrations. Configuration presence does not authenticate provider credentials or establish live synchronization.

Hosted workspace observations from Neon at audit time:

- Latest successful Meta import: 17 October 2026, 17:25 IST. Latest successful Shopify import: 17 October 2026, 12:28 IST. No queued/running imports were observed; both snapshots are stale. Worker processes were not inspected.
- Stored Shopify order records: 0. Journeys: 0. Registered experiments: 0. There is no representative live order/journey/experiment acceptance dataset yet.
- Saved actual-cost periods: 0. Enabled report schedules: 0. Saved custom dashboards: 0. Creative assets: 0. Features are installed; user configurations/content are not seeded automatically.
- The connected Meta grant lacks ads_management. Advertising-write flags are disabled in both local environment files checked. Reviewed execution is therefore not ready in those configurations.
- OPENAI_API_KEY is present in local `.env`, absent from local `.env.netlify`. Actual Netlify environment-variable state and current OpenAI credits/model access were not inspected. A missing hosting-file value is not proof the deployed environment lacks it.
- Email syntax/configuration checks passed for a custom sender. Sender DNS verification, provider authentication and inbox delivery were not tested. No test email or paid AI request was sent.

## Operational priorities

1. Keep the external Meta/Shopify/reports runner active against the cloud environment and confirm fresh successful imports.
2. Verify deployed OpenAI configuration separately and current API billing/model access before generation.
3. Verify sender domain and one intended invitation/report email after selecting the recipient.
4. Install the combined Shopify measurement pixel and experiment theme snippets, then validate consent, actual purchases and mature outcomes.
5. Record actual costs, create desired report schedules/dashboard layouts and add genuine creative assets.

Netlify request hosting does not run a persistent workers loop. This audit did not start workers, change advertising permissions, upload retained assets, send messages or modify business records.
