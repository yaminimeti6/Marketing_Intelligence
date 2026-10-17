import { fileURLToPath } from 'node:url';
import { configureLocalDatabase } from './local-db-config.mjs';

// Credentials arrive through private process stdin, never command arguments or files.
try {
  let input = '';
  for await (const chunk of process.stdin) {
    input += chunk;
    if (input.length > 16384) throw new Error('Input too large');
  }
  let passwords;
  try { passwords = JSON.parse(input); } catch { throw new Error('Invalid setup input'); }
  input = '';
  try {
    await configureLocalDatabase(fileURLToPath(new URL('../.env', import.meta.url)), passwords);
  } finally {
    for (const key of Object.keys(passwords)) passwords[key] = null;
  }
  console.log('Both connections verified. Database URLs saved privately. No migrations run.');
} catch (error) {
  const message = error?.message ?? '';
  const allowed = /^(northstar_(app|migrator): (password not accepted|role permissions need checking|database connection unavailable)\. No changes saved\.|Both passwords are required\. No changes saved\.|Environment file changed during setup\. No changes saved\.)$/;
  console.error(allowed.test(message) ? message : 'Setup could not finish. No credentials displayed; check the local helper and .env availability.');
  process.exitCode = 1;
}
