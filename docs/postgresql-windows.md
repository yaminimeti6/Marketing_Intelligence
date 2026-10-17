# Native PostgreSQL on Windows (no Docker)

## Verified local configuration — October 15, 2026

This workspace now runs PostgreSQL 18.6 directly on Windows, using northstar_db at 127.0.0.1:5432. Do not recreate or reset that database. The existing database remains owned by postgres. northstar_migrator has CONNECT plus USAGE/CREATE on public; northstar_app has CONNECT/USAGE without schema CREATE. The migration grants runtime table privileges and creates tables owned by northstar_migrator. Both roles have no superuser, role/database creation, replication or BYPASSRLS privileges. The first Owner and private encryption configuration are active. See milestone-1.md for final verification.

For an existing database, an administrator can provision the roles separately and grant the above schema permissions rather than changing database ownership. The fresh-install examples below use PostgreSQL 17 paths and a database named northstar; adapt them to your installed version/database. For this workspace, use PostgreSQL\\18 paths and northstar_db, and skip role/database creation because they already exist.

This is an alternative to Compose, not a replacement. No virtualization, WSL or Docker is required for this path. Keep compose.yaml and db/init/001-role.sh for Docker users.

The current project uses node-postgres (`pg`) and versioned SQL in db/migrations, not Prisma. No Prisma schema or Prisma migration files were found during inspection. These instructions preserve the existing SQL schema/migrations, authentication and encryption architecture.

Follow one step at a time. In guided setup, confirm completion before moving on. Do not share passwords, connection strings, encryption keys or .env contents in chat.

## Step 1: Install PostgreSQL

1. Open https://www.postgresql.org/download/windows/ and follow the EDB installer link.
2. Choose the latest PostgreSQL **17.x Windows x86-64** installer, matching the project's Docker major version.
3. Run the installer. Select PostgreSQL Server and Command Line Tools; pgAdmin 4 is optional. Keep the default installation/data directories unless you have a reason to change them.
4. Choose a strong, unique password for the `postgres` administrator. Save it in your password manager. This administrator password is not the application password.
5. Keep port **5432** if available. If occupied, record the alternative port for later connection configuration. Keep the default locale.
6. Complete installation. Stack Builder add-ons are not required.
7. In a new PowerShell window, verify (adjust the path if installed elsewhere):

```powershell
& 'C:\Program Files\PostgreSQL\17\bin\psql.exe' --version
& 'C:\Program Files\PostgreSQL\17\bin\pg_isready.exe' -h 127.0.0.1 -p 5432
```

Expected: a PostgreSQL 17 version and `accepting connections`. If the service is not running, inspect Windows Services for the installed PostgreSQL service. Stop here for confirmation. No database credentials or .env changes are required yet.

## Step 2: Provision the database and restricted roles

Only after installation is confirmed, connect locally using a password prompt:

```powershell
& 'C:\Program Files\PostgreSQL\17\bin\psql.exe' -h 127.0.0.1 -p 5432 -U postgres -d postgres -W
```

In psql, run the following on a fresh installation. If a role/database already exists, stop and inspect it rather than deleting or overwriting it.

```sql
CREATE ROLE northstar_migrator LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
\password northstar_migrator
CREATE ROLE northstar_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
\password northstar_app
CREATE DATABASE northstar OWNER northstar_migrator;
\connect northstar
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
\quit
```

Each `\password` command prompts privately; use different strong passwords. Do not type literal passwords into SQL commands or shell command arguments. The migration user owns the database; the runtime user has only grants supplied by the existing migration. Neither runtime superuser nor BYPASSRLS is permitted.

## Step 3: Configure local environment and encryption

Create a private .env from .env.example only if .env does not already exist. Configure DATABASE_URL with northstar_app and MIGRATION_DATABASE_URL with northstar_migrator. Use 127.0.0.1 and the installed port. URL-encode passwords locally before putting them into URLs. Never use the postgres administrator as the runtime application user.

Generate 32 random bytes with Node's crypto.randomBytes and save their base64 encoding directly into TOKEN_ENCRYPTION_KEY in the private file; do not print it into chat or shared logs. Keep TOKEN_ENCRYPTION_KEY_ID=local-v1. The guided environment step will provide a local-file generation command after database provisioning is confirmed. Docker-only POSTGRES_PASSWORD and APP_DB_PASSWORD are not required for native PostgreSQL.

## Step 4: Migrate and create the Owner

From the project directory, after private environment configuration:

```powershell
npm.cmd run db:migrate
```

Set BOOTSTRAP_EMAIL, BOOTSTRAP_NAME, BOOTSTRAP_WORKSPACE and BOOTSTRAP_PASSWORD privately in .env. Use a unique 12–256-character password. Then run:

```powershell
npm.cmd run db:bootstrap
```

Remove BOOTSTRAP_PASSWORD after success. The existing bootstrap creates an Owner, including administrative privileges; a separate Admin is not required for first access. No default account or public signup is introduced.

## Step 5: Validate and review

```powershell
npm.cmd test
npm.cmd run typecheck
npm.cmd run build
npm.cmd run dev
```

Open http://127.0.0.1:3000/login and sign in with the privately provisioned Owner. Verify incorrect credentials are rejected, successful login reaches the workspace, reload retains the session and sign-out removes access. Check http://127.0.0.1:3000/api/health returns ready with integrations disabled. Review phone/desktop layouts. Native database activation and live authentication checks remain pending until setup is actually performed.

For configured-database browser checks, set PLAYWRIGHT_OWNER_LOGIN_FILE to the private local login file and run the suite. For an unconfigured server, omit that variable. Set PLAYWRIGHT_BASE_URL for a different local port. Embedded database tests do not replace native service validation; both were completed for the configuration documented above.

Meta Ads and Shopify API integration remain disabled throughout this foundation setup.
