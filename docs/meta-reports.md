# Meta reports and CSV

> Historical increment record. For current features, setup and outstanding requirements, see [reporting update](reporting-update.md) and [PDF audit](pdf-feature-audit.md).

Implemented October 16, 2026 while Shopify administrator access is pending. `/reports` is a real Meta reporting route, separate from synthetic `/design-preview` screens. No Shopify API or store changes are needed.

- Uses the same workspace-scoped source loader, reporting scope/date controls, entity filters and metric definitions as `/meta` and `/campaigns`.
- CSV downloads all filtered entity rows across pages, using the visible table's current name/spend/purchase/ROAS sorting. Server exports and the visible table share one selector/calculator. Overall KPI cards remain account-scoped; search/status/parent filters affect entity rows and CSV only, as labeled.
- CSV includes source, dates, currency, timezone, coverage, generation time, account/entity identifiers, metrics, last completed account sync and attribution caveats. No Shopify revenue or independent attribution is implied.
- Exact string monetary values are preserved. Unavailable metrics are N/A, successful empty activity remains zero where defined, and unique reach is never fabricated. Empty exports contain headers and a metadata row, with zero entity rows. Incomplete coverage is explicitly marked.
- UTF-8 BOM and CRLF support spreadsheets; every field is quoted and escaped, formula-leading strings (including whitespace prefixes) are neutralized.
- Authenticated same-origin POST only; server re-loads data under current membership and RLS, ignores caller-supplied records, validates filters and refuses unavailable reports. Download responses are private/no-store. Generation is limited to ten files per user per minute.
- Personal named presets store applied absolute dates/account/scope/hierarchy/status/search/compare filters. Matching names update; delete removes only the current user's preset. Maximum 50 presets per user. Dates are fixed snapshots, not rolling schedules; local table sorting is not saved in presets.
- Append-only per-user export history records server generation, not proof of client delivery. Files/data snapshots themselves are not stored. Ten recent entries appear on the Reports page. Presets and history are isolated by workspace and user, including viewer access.

Migration 005 adds report_presets/report_exports with forced RLS; applied locally without resetting existing data. No automated jobs, new provider calls or real ad changes were triggered. PDF/email schedules and advanced dimensions remain outside this increment. No automatic sync or production deployment was configured.

Validation: 32 unit/database tests and production build/TypeScript passed. Tests cover exact money, shared hierarchy/filter logic, formula escaping, missing/empty distinctions, user/workspace isolation and viewer-safe append-only history. Production-browser verification is recorded after the run below.

Authenticated production-browser checks passed for actual CSV download, saved filter open/delete, generated-export history and 401/403 access rejection. The browser surfaced a loopback Origin/Host reconstruction mismatch; it was fixed with strict Host matching, HTTPS for remote origins and HTTP allowance only for loopback. A regression test covers the mismatch and cross-origin denial.
All 9 production browser tests passed. Reports also passed the added responsive route check at 375, 768, 1024 and 1440 pixels. Temporary browser-created presets were removed; append-only history retains the genuine verification export event. Verification server was stopped after checks.
