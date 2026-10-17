# UI review scope

> Historical increment record. For current features, setup and outstanding requirements, see [reporting update](reporting-update.md) and [PDF audit](pdf-feature-audit.md).

Uses PDF appendix tokens: #F5F7FB background, #101C32 navigation/headings, #3568E8 primary, #159B76 positive, #F2A34B warning and #DFE5EE border. Desktop sidebar is 240px; header 72px; 8px spacing baseline; 12px modal radius and restrained card borders. Mobile navigation is a drawer and campaign tables become readable cards.

## Release boundaries

MVP visual preview: Overview, Analytics, read-only Campaigns, report builder/CSV, integration setup/status and workspace settings. All records are explicitly demo fixtures. Browser storage is convenience storage and is not a backend, authentication system or secure audit log.

Phase 1 visual exploration: first/last/linear attribution and journey examples. Production tracking, consent, identity resolution and actual attribution calculations are absent. Pause/resume, budget editing, PDF, schedules and invitations explain prerequisites and do not fabricate success.

## Interaction review

1. Select 7 days and compare KPI totals with the 30-day view.
2. Filter Meta, search for creative, and choose Paused; inspect one matching campaign.
3. Export CSV and verify only matching campaigns appear and DEMO DATA is included.
4. Change grouping to weekly/monthly and open the accessible chart table.
5. Open a campaign and review source metrics and disabled write actions.
6. Switch attribution models and confirm credit changes in the synthetic journey.
7. Build a platform-dimension report, select metrics, generate and download.
8. Save/open/delete a report preset; refresh to verify browser-local persistence.
9. Open each integration setup and confirm no authorization or connection is claimed.
10. Save workspace preferences; clear local data under Privacy.

## Remaining production work

Identity, RBAC, tenant isolation, PostgreSQL, worker queue, real OAuth, provider imports, reconciliation, actual audit trails, deployment and observability are deliberately outside this frontend-preview authorization.
