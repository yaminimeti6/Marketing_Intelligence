# Milestone 1 — Foundation and Meta Access

> Historical increment record. For current features, setup and outstanding requirements, see [reporting update](reporting-update.md) and [PDF audit](pdf-feature-audit.md).

Implemented and locally verified October 15, 2026. Native Windows PostgreSQL 18.6 is active on 127.0.0.1:5432 with database northstar_db; Docker is not used locally and remains an optional supported path. This is the foundation milestone (originally numbered 0 in the proposal); the user's approval names it Milestone 1. Milestone 2 remains unauthorized until review.

## Delivered

- Meta-first responsive shell: 240px sidebar, 72px header, mobile navigation, reusable status/metric/empty-state components, campaign table structure and integration/settings pages. Existing palette and spacing retained. Unavailable metrics show dashes rather than invented zeroes.
- Sign-in/sign-out server actions, salted scrypt password hashes, random session tokens stored as SHA-256 hashes, 8-hour database sessions and HttpOnly/SameSite cookies (Secure with __Host- prefix in production). Atomic per-identity attempt limiting. Next.js server actions provide same-origin mutation protection. No default users or public signup.
- Transactional CLI workspace-owner provisioning and versioned migration. No production credentials committed.
- PostgreSQL workspaces/memberships, owner/admin/viewer roles, composite foreign keys, connections, credentials, durable job/cursor tables and append-only runtime audit grants.
- Tenant helper verifies membership and sets transaction-local identity/workspace context. Forced row-level policies deny missing context and non-member workspaces; viewers cannot write tenant integration tables. Tenant access and health checks reject superuser/BYPASSRLS roles.
- AES-256-GCM credential envelopes bound to workspace/provider/connection, with explicit key identifiers. Storage verifies admin/owner access and connection ownership. No OAuth callback or public credential endpoint exists.
- Queue primitives support idempotent enqueue and transactional SKIP LOCKED claims. Worker entrypoint explicitly exits without processing. Provider handlers, scheduling, retry/recovery loops and actual synchronization remain later work.
- Local PostgreSQL Compose service, restricted runtime role, environment template, health endpoint and baseline security headers.
- Existing synthetic design isolated at /design-preview, with navigation scoped there. Default routes import no demo records. No P1/P2 features added.

## Verification

TypeScript and optimized production build passed. Ten automated tests passed, covering existing data behavior, password/session primitives, credential tampering/key/tenant binding, safe environment configuration and the actual migration/policies on embedded PostgreSQL. Eight browser tests passed against the production build using the configured local Owner. Private credentials were never printed by these checks.

Browser checks cover honest empty states, absence of provider network calls, health status, mobile navigation and layouts at 375/768/1024/1440px. Preserved preview regression checks remain separate. Additional production-mode browser checks verified incorrect-password rejection, real Owner login, Secure/HttpOnly/SameSite cookies, reload persistence, sign-out, protected-route denial and expired-session rejection. The user also confirmed successful login, refresh persistence and sign-out on the local app.

Native PostgreSQL checks verified 11 tables, the migration record, 5 forced-RLS tables and 10 policies. A transaction-only test allowed the Owner's own workspace access and denied cross-workspace reads/updates; rollback removed the test record and cleared local tenant context. No provider connection persisted. App role schema creation, superuser and BYPASSRLS remain denied. The database is owned by postgres; foundation tables are owned by northstar_migrator. Encryption round-trip and wrong-workspace rejection passed with the configured local key.

The original setup-only browser suite initially expected an unconfigured database. It was updated to authenticate once when a private Owner login file is explicitly supplied, then rerun successfully against the configured database. Setup-state coverage remains available when a genuinely unconfigured server is used.

## Local activation completed

The native PostgreSQL service, separate migration/runtime roles, private URLs, 32-byte encryption key and first Owner are configured. Temporary database-password setup files were removed. The private local Owner login file is ignored by source control; it is a temporary handoff, not a password-change interface. Editing that text file does not change the database password. Keep it private and transfer credentials to private password storage before deleting it. Never share selected credentials through IDE context.

Identity tables are private server authentication infrastructure, not a public client API; tenant integration/job/audit tables have RLS. Deployment TLS, managed keys and broader operations remain production work.

## Later credentials and work

- Meta milestone: developer app credentials, supported API version, appropriate reporting access and applicable app review/business verification, authorized ad accounts, production HTTPS domain and registered OAuth callback. No Meta credentials are needed for the foundation preview.
- Shopify milestone: app configuration, authorized store, minimum Admin API read scopes and permitted historical-order/data access.
- Production operations: managed keys/secrets and rotation, network-level abuse protection, expired-session cleanup, monitoring, backups, password recovery/MFA or managed identity as appropriate, and infrastructure smoke tests. Per-identity sign-in limits do not replace deployment-level distributed abuse protection.

Meta OAuth, account imports and metrics, Shopify imports and combined reporting remain pending. All future campaign writes, bulk tools, automation, profit reporting, AI, attribution and other ad platforms remain on the roadmap. Wait for Milestone 1 review before starting Milestone 2.
