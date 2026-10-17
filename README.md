# Northstar — Marketing Intelligence

Meta Ads first, Shopify second. Real Meta reporting, Shopify imports/events, unified Meta campaign Analytics, report presets/CSV, source comparisons, team settings and [reporting rules/in-app alerts](docs/rules-alerts.md) are implemented. Production routes never substitute demo metrics. See [current status](docs/reporting-update.md) and the [PDF audit](docs/pdf-feature-audit.md) for remaining work. Older milestone documents record historical increments.

## Start and preview

Use Node.js 24 LTS and npm. No database or credentials are needed to review the empty foundation layout:

```powershell
npm.cmd install
npm.cmd run dev
```

Open http://127.0.0.1:3000 (Meta-first landing), `/integrations`, `/settings`, or `/login`. Stop with Ctrl+C. Leave DATABASE_URL unset for the data-free setup shell. A configured database enables authenticated routing; an unavailable configured database fails closed.

The preserved synthetic design is at `/design-preview/overview`. Every fixture is DEMO DATA; its reports and attribution are historical design explorations, not production features. Existing UI specifications remain in docs/ui-preview.md.

## Enable PostgreSQL and sign-in

Choose either native PostgreSQL on Windows or Docker Desktop with Compose. Both use the same database schema, migrations, authentication and encryption. Docker is optional.

**Without Docker:** follow [Native PostgreSQL on Windows](docs/postgresql-windows.md). Install PostgreSQL 17, provision the two database roles and the database, then run the existing migration and owner-bootstrap commands. Skip `docker compose up` for this path.

**With Docker:** keep using the existing Compose configuration and the steps below.

1. Copy `.env.example` to `.env`. Set distinct strong POSTGRES_PASSWORD and APP_DB_PASSWORD values and put their URL-encoded forms in the corresponding database URLs. Keep northstar_app separate from northstar_migrator.
2. Generate TOKEN_ENCRYPTION_KEY with `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`. Keep it private. TOKEN_ENCRYPTION_KEY_ID identifies the key; production requires managed secret storage and rotation.
3. Set BOOTSTRAP_EMAIL, BOOTSTRAP_NAME, BOOTSTRAP_WORKSPACE and a unique BOOTSTRAP_PASSWORD of 12–256 characters. There are no default credentials or public registration.
4. Run:

```powershell
docker compose up -d --wait
npm.cmd run db:migrate
npm.cmd run db:bootstrap
npm.cmd run dev
```

Sign in at http://127.0.0.1:3000/login. Remove BOOTSTRAP_PASSWORD after provisioning. Bootstrap creates a new owner/workspace atomically and refuses duplicate email; it does not reset passwords.

Compose creates the restricted runtime role only on first database initialization. For existing databases an administrator must provision it following db/init/001-role.sh before migrating. Changing .env does not update passwords in an existing volume. For external services use the provider's TLS configuration. Never use superuser, BYPASSRLS or migration credentials in DATABASE_URL. Never use NEXT_PUBLIC_ variables for secrets.

GET /api/health checks application migrations and runtime-role flags; provider readiness is separate on Integrations. `npm.cmd run worker`, `worker:shopify` process separate bounded passes. Keep `npm.cmd run workers:watch` open alongside the app for recurring local imports, scheduled every 60 seconds by default with five-second queue polling. Existing Owner/Admin worker identities are required; provider limits can delay updates. Hosting remains deferred.

## Validation

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
npm.cmd start
# In a second terminal, with Chrome installed and DATABASE_URL unset:
npm.cmd run test:browser
```

Browser tests default to port 3000. For a configured local database, explicitly supply the private Owner login file; the foundation tests authenticate once without printing credentials:

```powershell
$env:PLAYWRIGHT_OWNER_LOGIN_FILE='.env.owner-login.txt'
npm.cmd run test:browser
```

Use PLAYWRIGHT_BASE_URL to target another local port. Tests also support a genuinely unconfigured server without a private login file. Do not point these checks at a production customer workspace. Database tests execute the migration/policies in PGlite; native PostgreSQL 18.6, real Owner login, session security and transaction-only tenant isolation were also verified locally. See docs/milestone-1.md.

Next.js App Router, TypeScript, Tailwind and Recharts remain the frontend stack. PostgreSQL migrations, membership checks, owner/admin/viewer roles, opaque sessions, authenticated encryption and durable queue primitives establish backend boundaries. Identity tables are private server authentication infrastructure; tenant-owned integration/job/audit tables enforce row-level policies. No generic database access is exposed to the client.

See docs/milestone-1.md for completed foundation verification, docs/milestone-2.md for active Meta implementation and docs/implementation-plan.md for the approved roadmap. Shopify follows the accepted Meta reporting release. No P1/P2 capabilities have been added.



