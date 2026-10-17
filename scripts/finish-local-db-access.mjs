import { readFile, unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { configureLocalDatabase } from './local-db-config.mjs';

const pending = fileURLToPath(new URL('../.env.local-db.pending', import.meta.url));
const sqlFile = fileURLToPath(new URL('../.env.local-db-roles.sql', import.meta.url));
try {
  const passwords = JSON.parse(await readFile(pending, 'utf8'));
  await configureLocalDatabase(fileURLToPath(new URL('../.env', import.meta.url)), passwords);
  for (const key of Object.keys(passwords)) passwords[key] = null;
  console.log('Both role connections verified. .env updated privately. No migrations run.');
  await unlink(pending);
  await unlink(sqlFile);
  console.log('Temporary local setup files removed.');
} catch {
  console.error('Setup not complete. Local setup files retained; no secrets displayed. Confirm the SQL was committed on the local server.');
  process.exitCode = 1;
}
