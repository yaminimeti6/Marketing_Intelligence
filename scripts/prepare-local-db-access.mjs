import { randomBytes, pbkdf2Sync, createHmac, createHash } from 'node:crypto';
import { writeFile, access, unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// Local bootstrap alternative: generated passwords never enter terminal output or SQL.
const pending = fileURLToPath(new URL('../.env.local-db.pending', import.meta.url));
const sqlFile = fileURLToPath(new URL('../.env.local-db-roles.sql', import.meta.url));
let pendingCreated = false;
try {
  for (const file of [pending, sqlFile]) {
    try { await access(file); throw new Error('EXISTS'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  const passwords = {};
  const statements = ['-- Private local role-password setup. Do not share this file.', 'BEGIN;'];
  for (const role of ['northstar_app', 'northstar_migrator']) {
    const password = randomBytes(32).toString('base64url');
    passwords[role] = password;
    const salt = randomBytes(16);
    const salted = pbkdf2Sync(password, salt, 4096, 32, 'sha256');
    const clientKey = createHmac('sha256', salted).update('Client Key').digest();
    const storedKey = createHash('sha256').update(clientKey).digest('base64');
    const serverKey = createHmac('sha256', salted).update('Server Key').digest('base64');
    const verifier = `SCRAM-SHA-256$4096:${salt.toString('base64')}$${storedKey}:${serverKey}`;
    statements.push(`ALTER ROLE ${role} LOGIN PASSWORD '${verifier}';`);
    salted.fill(0); clientKey.fill(0);
  }
  statements.push('COMMIT;', '');
  await writeFile(pending, JSON.stringify(passwords), { flag: 'wx', mode: 0o600 });
  pendingCreated = true;
  await writeFile(sqlFile, statements.join('\n'), { flag: 'wx', mode: 0o600 });
  console.log('Local setup files prepared. Existing .env and database unchanged.');
  console.log('Next: open .env.local-db-roles.sql in pgAdmin Query Tool as postgres and execute it.');
} catch (error) {
  if (pendingCreated) await unlink(pending).catch(() => {});
  console.error(error.message === 'EXISTS' ? 'Pending setup already exists; files preserved. Do not regenerate.' : 'Could not prepare local setup; no secrets displayed.');
  process.exitCode = 1;
}
