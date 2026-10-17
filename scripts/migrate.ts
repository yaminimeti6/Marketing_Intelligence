import { readFile, readdir } from 'node:fs/promises';
import pg from 'pg';
if (!process.env.MIGRATION_DATABASE_URL) throw new Error('MIGRATION_DATABASE_URL is required.');
const client = new pg.Client({ connectionString: process.env.MIGRATION_DATABASE_URL });
await client.connect();
try {
  await client.query('BEGIN');
  await client.query("SELECT pg_advisory_xact_lock(8462101)");
  await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
  const directory = new URL('../db/migrations/',import.meta.url);
  const files = (await readdir(directory)).filter(file => /^\d{3}_[a-z0-9_]+\.sql$/.test(file)).sort();
  for (const file of files) {
    const name = file.slice(0,-4);
    const applied = await client.query('SELECT name FROM schema_migrations WHERE name=$1',[name]);
    if (!applied.rowCount) {
      await client.query(await readFile(new URL(file,directory),'utf8'));
      await client.query('INSERT INTO schema_migrations(name) VALUES($1)',[name]);
    }
  }
  await client.query('GRANT SELECT ON schema_migrations TO northstar_app');
  await client.query('COMMIT');
  console.log('Versioned migrations are up to date. No database reset performed.');
} catch (error) { await client.query('ROLLBACK'); throw error; }
finally { await client.end(); }
