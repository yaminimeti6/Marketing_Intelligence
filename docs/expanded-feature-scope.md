# Expanded feature scope — 19 October 2026

Validation for the Creative Insights increment: production build and TypeScript passed; all 87 unit/database tests passed. Authenticated production-server browser check loaded the new route with no page errors and no page overflow at 375, 768 and 1440 pixels. Financially representative ad activity was not present to live-validate the fatigue heuristic; deterministic fixtures cover coverage gaps, low samples and exact-reach availability.

The user requested the supplied FabFunnel, Madgicx, Triple Whale and Northbeam feature lists. These are user requirements, not independently verified vendor claims. Existing Meta and Shopify scope remains; Google Ads is not restored. The user has no AI service credentials and requested data-backed features first.

Update: the user subsequently supplied a private OpenAI API key and authorized Co-Pilot and Copywriter integration. `/ai` now provides aggregate Meta report questions and ad-copy drafts in English, Gujarati and Hindi. Other AI/video/image features in the outstanding matrix remain pending. See [AI Assistant setup and boundaries](ai-assistant.md).

Profit increment: `/profit-planner` now provides a manual contribution/operating scenario calculator, margins, fixed-sales break-even metrics and local CSV. It does not import costs or certify actual profit. See [Profit Planner](profit-planner.md). AI remains unavailable without API credits.

Image increment: `/ai-images` adds one-image generation, preview and JPEG download using the existing OpenAI key. Paid credits and model access remain required. Video was explicitly deferred after verifying OpenAI Videos/Sora retirement. See [AI Images](ai-images.md).

Measurement increment: consent-based pseudonymous receiver, observed journeys, order-count first/last/linear attribution, first-observed purchase cohorts and registered randomized storefront headline/landing experiments are implemented. Shopify pixel/theme installation and representative live acceptance remain pending. This does not complete Meta-side creative experiments, verified customer identity, financial revenue attribution or full-history cohorts. See [measurement setup and boundaries](journeys-experiments.md).

Campaign-action increment: `/ad-manager` now supports paused campaign containers and reviewed bulk ACTIVE/PAUSED/daily-budget operations on up to five imported objects. Execution defaults off, needs ads_management and exact user confirmation, and was not live-tested. Full new ad-set/creative/ad launching and automatic uncertain-outcome reconciliation remain pending. See [Campaign Actions](campaign-actions.md).

## Current implementation

| Requested area | Actual status |
| --- | --- |
| Dashboard, Ads Dashboard, Summary Dashboard, Marketing Dashboard, Analytics Dashboards | Implemented using imported Meta and Shopify data; coverage and currency/timezone guards apply. |
| Multi Ad Account | Meta account discovery, selection and compatible reporting scopes implemented. |
| Advanced Reporting, Automated Reporting, One-Click Reports | Filters, saved report configurations, CSV and browser printing implemented. Scheduled Meta campaign CSV snapshots and member email notifications are implemented; see [Scheduled Reports](scheduled-reports.md). An active external worker and configured verified sender are required. Scheduled PDF and public share links remain pending. |
| Team Management | Roles, invitations, memberships, audit and workspace settings implemented. Email delivery requires verified sender. |
| Alerts & Notifications, Campaign Automation, Custom Automation | Rule evaluation, dry runs, cooldown and in-app alerts implemented. Ad mutations and external notifications remain pending. |
| Revenue Tracking, Shopify Integration, Sales Analytics, Ad Performance, ROAS Analysis, Product Analytics | Imported commerce, product analysis, Shopify Net Sales and guarded MER implemented. Financial reconciliation with representative paid/refunded orders remains a live acceptance requirement. |
| Triple Pixel, First-Party Data, Website Analytics | Consent-aware aggregate browser events implemented. No user identity stitching or visitor-level journey collection. |
| Multi-Platform Reporting, Channel Performance | Meta and Shopify combined source reporting implemented; distinct attribution semantics retained. |
| Creative Insights, Creative Fatigue Detection | New `/creative-insights` page: imported ad-level metrics, exact-range frequency, prior-period CTR/CPA changes and explicit bounded fatigue heuristic. Not deduplicated by creative asset. |
| A/B Testing | New two-ad observational comparison. Randomized assignment, significance, stopping rules and experiment lifecycle remain pending. |

## Outstanding implementation

| Area | Required work / dependency |
| --- | --- |
| Bulk Campaign Launcher, Ads Manager 2.0, Bulk Actions | Advertising write scopes, draft validation, review, explicit publish confirmation, idempotency, provider errors, audit and rollback strategy. Existing integration is read-only. |
| AI Creative Generator, AI Ad Generator, AI Copywriter, AI Co-Pilot, AI Marketer, Moby AI, Video Sage | AI provider configuration, quotas, secure server adapter, grounding and output review. No AI service configured. Rule-based signals are not labeled AI. |
| Creative Library | Tenant-scoped asset storage/upload, validation, thumbnails, tags, deletion and provider mapping. Existing ad entity names are not a media library. |
| Funnel Engine | Draft landing pages, publishing, domain/path ownership, consent and conversion instrumentation. |
| Industry Insights | Authorized competitor/ad-library data source and search permissions; no competitor dataset imported. |
| Profit Analytics | Dated SKU COGS, fees, shipping, tax treatment, refunds and currency validation. Net Sales minus ad spend is not net profit. |
| Cloud Tracking | Consent-aware server-side conversion delivery, provider credentials, deduplication and verified event matching. Aggregate pixel ingestion is not Meta CAPI. |
| Multi-Touch Attribution, Customer Journey, Customer Journey Analysis, Revenue Attribution | Consent and retention model, observed touchpoint collection, identity strategy, order linkage, model definitions and reconciled unattributed bucket. Current aggregates cannot reconstruct journeys. |
| Customer Segmentation, Cohort Analysis | Authorized customer/order history, identity minimization, cohort definitions, retention and LTV coverage. Current store has no imported orders. |
| Custom Dashboard | Persistent tenant-scoped widget configuration, metric registry and compatible scope checks. |
| Data Warehouse | Existing PostgreSQL is application storage; external warehouse connectors, lineage and governed exports remain pending. |
| Marketing Mix Modeling, Media Mix Modeling, Incrementality Measurement, Budget Allocation Insights | Sufficient historical channel/outcome data, controls, holdouts or experiments, uncertainty estimates and validation. Single-channel sparse data cannot support causal claims. |
| Northbeam Apex | Vendor-specific proprietary product; equivalent integrations need their own authorized provider implementations. |

## Operational boundary

Netlify hosts requests, not the persistent watch process. Imports still need an active external runner; free hosting does not establish continuous sync. New page code does not change ad budgets, publish campaigns, send external emails or enable new identity tracking.

Creative signals need complete imports for selected and previous periods. A signal requires ≥3 selected days, ≥1,000 impressions in both periods, CTR decline ≥20%, plus exact ad-range frequency ≥3 or CPA rise ≥20%. This is a review heuristic, not causal proof of fatigue. Separate ads can have different audiences, placements, budgets and attribution histories. No experimental winner is assigned.
