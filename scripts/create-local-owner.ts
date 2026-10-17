import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { readFile, writeFile, unlink, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import { randomBytes } from 'node:crypto';
import pg from 'pg';
import { hashPassword } from '../src/lib/security.ts';

const credentialsFile = fileURLToPath(new URL('../.env.owner-login.txt', import.meta.url));
const rl = createInterface({ input: stdin, output: stdout });
let client: pg.Client | undefined;
let fileCreated = false;
let committed = false;
try {
  try { await access(credentialsFile); throw new Error('FILE_EXISTS'); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  const env = parseEnv(await readFile(new URL('../.env', import.meta.url), 'utf8'));
  const url = new URL(env.MIGRATION_DATABASE_URL ?? '');
  if (!['127.0.0.1','localhost'].includes(url.hostname) || url.port !== '5432' || url.pathname !== '/northstar_db' || decodeURIComponent(url.username) !== 'northstar_migrator') throw new Error('CONFIG');
  const name = (await rl.question('Your name: ')).trim();
  const email = (await rl.question('Owner login email: ')).trim().toLowerCase();
  const workspace = (await rl.question('Workspace name: ')).trim();
  if (!name || name.length > 100 || !workspace || workspace.length > 150 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('INPUT');
  const password = randomBytes(24).toString('base64url');
  const hash = hashPassword(password);
  client = new pg.Client({ connectionString: env.MIGRATION_DATABASE_URL, connectionTimeoutMillis:5000, query_timeout:5000 });
  await client.connect();
  await client.query('BEGIN');
  const user = await client.query('INSERT INTO users(email,name,password_hash) VALUES($1,$2,$3) RETURNING id', [email,name,hash]);
  const ws = await client.query('INSERT INTO workspaces(name) VALUES($1) RETURNING id',[workspace]);
  await client.query("INSERT INTO memberships(workspace_id,user_id,role) VALUES($1,$2,'owner')",[ws.rows[0].id,user.rows[0].id]);
  await writeFile(credentialsFile, `PRIVATE LOCAL LOGIN — do not share or upload\n\nURL: http://127.0.0.1:3000/login\nEmail: ${email}\nPassword: ${password}\nWorkspace: ${workspace}\n\nSave the login in your private password storage, then delete this file.\n`, {flag:'wx',mode:0o600});
  fileCreated = true;
  await client.query('COMMIT');
  committed = true;
  console.log('Owner and workspace created successfully.');
  console.log('Login credentials saved privately in .env.owner-login.txt. Open it locally; never paste its contents into chat.');
  console.log('Database-role passwords and encryption key are unchanged. No integrations started.');
} catch (error) {
  if (client && !committed) await client.query('ROLLBACK').catch(()=>{});
  if (fileCreated && !committed) await unlink(credentialsFile).catch(()=>{});
  const code = (error as NodeJS.ErrnoException).code;
  const message = (error as Error).message;
  if (message==='FILE_EXISTS' || code==='EEXIST') console.error('Private owner login file already exists. Preserved; no account overwritten.');
  else if (code==='23505') console.error('Owner email already exists. No account or password overwritten.');
  else if (message==='INPUT') console.error('Enter a valid email, name and workspace name. No account created.');
  else console.error('Owner setup could not finish. Secret details withheld; no successful setup claimed.');
  process.exitCode=1;
} finally {
  rl.close();
  if (client) await client.end().catch(()=>{});
}
