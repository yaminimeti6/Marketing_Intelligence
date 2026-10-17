import { readFile, writeFile, rename, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

const roles = ['northstar_app', 'northstar_migrator'];
export async function verifyConnection(role, password) {
  const client = new pg.Client({ host: '127.0.0.1', port: 5432, database: 'northstar_db', user: role, password, connectionTimeoutMillis: 5000, query_timeout: 5000 });
  try {
    await client.connect();
    await client.query('BEGIN READ ONLY');
    const { rows } = await client.query(`SELECT current_user AS name, rolsuper, rolbypassrls,
      has_schema_privilege(current_user,'public','USAGE') AS usage,
      has_schema_privilege(current_user,'public','CREATE') AS create_schema_objects
      FROM pg_roles WHERE rolname=current_user`);
    const actual = rows[0];
    if (!actual || actual.name !== role || actual.rolsuper || actual.rolbypassrls || !actual.usage || actual.create_schema_objects !== (role === 'northstar_migrator')) {
      throw new Error('PERMISSIONS');
    }
    await client.query('ROLLBACK');
  } catch (error) {
    // Never include a provider error, connection string or password in console output.
    const reason = error.code === '28P01' ? 'password not accepted' : error.message === 'PERMISSIONS' ? 'role permissions need checking' : 'database connection unavailable';
    throw new Error(`${role}: ${reason}. No changes saved.`);
  } finally { await client.end().catch(() => {}); }
}

export async function configureLocalDatabase(file, passwords, verify = verifyConnection) {
  const original = await readFile(file, 'utf8');
  for (const role of roles) {
    if (typeof passwords[role] !== 'string' || !passwords[role]) throw new Error('Both passwords are required. No changes saved.');
  }
  // Verify raw credentials before encoding or writing anything.
  for (const role of roles) await verify(role, passwords[role]);
  const newline = original.includes('\r\n') ? '\r\n' : '\n';
  let lines = original.replace(/^\uFEFF/, '').split(/\r?\n/);
  for (const role of roles) {
    const key = role === 'northstar_app' ? 'DATABASE_URL' : 'MIGRATION_DATABASE_URL';
    const pattern = new RegExp(`^\\s*(?:export\\s+)?${key}\\s*=`);
    lines = lines.filter(line => !pattern.test(line));
    // Encode all URL-sensitive password characters, including dotenv's comment marker.
    const encoded = encodeURIComponent(passwords[role]).replace(/[!'()*]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
    lines.push(`${key}=postgresql://${role}:${encoded}@127.0.0.1:5432/northstar_db`);
  }
  const updated = lines.join(newline);
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, updated, { flag: 'wx', mode: 0o600 });
    if (await readFile(file, 'utf8') !== original) throw new Error('Environment file changed during setup. No changes saved.');
    await rename(temporary, file);
  } finally { await unlink(temporary).catch(() => {}); }
}
