# Rules and in-app alerts

Implemented 17 October 2026 at `/alerts`. These are reporting notifications inside Northstar. They do not send email/Slack messages, publish ads, change budgets or pause campaigns.

## Use

1. Open **Rules & Alerts** in the sidebar.
2. As an Owner/Admin, choose a name, source channel, currency/timezone scope and account. Add one to five conditions with AND/OR logic. Monetary thresholds use the chosen source currency; CTR uses percentage points and ROAS uses a ratio.
3. Choose the last 1, 7, 14 or 28 **completed reporting days**, excluding today in the source timezone. Set cooldown from 1 to 168 hours.
4. Create the rule disabled, then use **Dry run** to inspect the outcome. Dry runs add an evaluation-history entry but create no alert and leave cooldown unchanged.
5. Enable the rule when ready. Keep the app and `npm.cmd run workers:watch` running locally. A standalone bounded check is available through `npm.cmd run worker:rules`.

Saved rules can be edited or enabled/disabled. Disabling retains alerts/history. Editing and toggling do not reset the last-alert timestamp, so they cannot bypass cooldown. Owners/Admins can mark an alert reviewed for the whole workspace. Analysts/Viewers can read rules and history but cannot create, edit, execute or review them.

## Data and evaluation

- Reads existing imported Meta campaign facts. No additional provider requests are made by rule evaluation. The same Analytics metric calculator and coverage rules are used; hierarchy levels are not added together.
- Currency/timezone scope is mandatory and fixed. No FX conversion or implicit movement to a newly discovered account scope occurs. Meta purchase attribution does not represent Shopify Net Sales or unique cross-channel purchases.
- All selected accounts need completed range coverage, connected status and a successful import within 15 minutes. Every condition metric must be known, even for OR rules. Pending/failed imports, missing values and zero-denominator ratios produce **unavailable**, not a substituted zero or an alert.
- Spend/value strings use exact decimal threshold comparisons. Derived ratios follow the reporting calculator's numeric precision. Thresholds allow up to 24 integer digits and six decimal places; scientific notation and formula strings are rejected.
- Normal automatic checks run about once a minute. When an import is pending, a check retries after ten seconds so it does not stay synchronized with the start of each import. Provider delays and a closed/offline runner can delay alerts.
- A per-rule row lock plus a repeatable-read tenant transaction keeps source reads consistent and serializes cooldown/notification creation. A rolled-back check creates no partial alert. Concurrent serialization failures retry on a later worker pass.
- Unchanged automatic checks update the rule summary without appending a log every minute. History records manual checks, automatic outcome changes and alerts. The UI shows the latest 50 alerts and 50 run records. Up to 50 rules are supported per workspace.
- Alert snapshots preserve the original rule name, conditions, evaluation window and observed values after a rule is edited. Runtime alert-result/history writes are append-only; only the review columns can be updated by the runtime role.

## Local setup

Migration `016_alert_rules` creates tenant-isolated rules, run history and alerts with forced RLS. It was applied locally without resetting existing data.

The recurring runner includes the rules worker automatically. Optional `RULES_WORKER_USER_ID` can identify a separate existing Owner/Admin. If unset, the first configured Meta/Shopify worker identity is reused. An Analyst/Viewer identity cannot execute rules. No new account, secret or paid service is required.

The rules page refreshes while visible every 15 seconds. This is local automation, not always-on hosting. No rules or sample alerts were seeded in the user's workspace during verification; the CLI correctly reported zero checks/alerts with no enabled rules.

## Verification

- TypeScript, production build and all 82 unit/database tests passed during this increment.
- Dedicated tests cover AND/OR, completed source-timezone dates, exact large monetary thresholds, missing/stale data, Meta fact loading, role/tenant isolation, dry runs, pending-import retry, cooldown, enable/disable behavior, immutable historical results and review permissions.
- All nine production browser checks passed, including condition editing, mobile widths, existing reporting/settings and no unintended alert creation. The rule form was exercised without saving a test rule to the user's workspace.

Email delivery, intraday custom windows, scheduled PDF reports and advertising actions remain separate features. Rules do not make verified Shopify Net Sales or MER available.
