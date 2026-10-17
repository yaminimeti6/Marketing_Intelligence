import pg from 'pg';
import { hashPassword } from '../src/lib/security.ts';
const { MIGRATION_DATABASE_URL, BOOTSTRAP_EMAIL, BOOTSTRAP_NAME, BOOTSTRAP_PASSWORD, BOOTSTRAP_WORKSPACE } = process.env;
if (!MIGRATION_DATABASE_URL || !BOOTSTRAP_EMAIL || !BOOTSTRAP_NAME || !BOOTSTRAP_PASSWORD || !BOOTSTRAP_WORKSPACE) throw new Error('Set the migration URL and all BOOTSTRAP_* values in .env.');
const passwordHash = hashPassword(BOOTSTRAP_PASSWORD);
const client = new pg.Client({ connectionString: MIGRATION_DATABASE_URL });
await client.connect();
try {
  await client.query('BEGIN');
  const user = await client.query('INSERT INTO users(email,name,password_hash) VALUES($1,$2,$3) RETURNING id',[BOOTSTRAP_EMAIL.trim().toLowerCase(),BOOTSTRAP_NAME,passwordHash]);
  const workspace = await client.query('INSERT INTO workspaces(name) VALUES($1) RETURNING id',[BOOTSTRAP_WORKSPACE]);
  await client.query("INSERT INTO memberships(workspace_id,user_id,role) VALUES($1,$2,'owner')",[workspace.rows[0].id,user.rows[0].id]);
  await client.query('COMMIT');
  console.log('Owner and workspace created. Remove BOOTSTRAP_PASSWORD from .env.');
} catch (error) { await client.query('ROLLBACK'); throw error; }
finally { await client.end(); }
