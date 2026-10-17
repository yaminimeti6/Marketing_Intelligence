import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseEnv } from 'node:util';
import { configureLocalDatabase } from '../scripts/local-db-config.mjs';

test('setup preserves .env when either connection fails, and correctly encodes verified passwords', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'northstar-setup-'));
  const file = join(directory, '.env');
  const original = 'TOKEN_ENCRYPTION_KEY=keep-this\r\nDATABASE_URL=old\r\nDATABASE_URL=duplicate\r\nMIGRATION_DATABASE_URL=old\r\n';
  const passwords = { northstar_app: 'test@#%$&!\' "value', northstar_migrator: 'different:@#%$&!value' };
  try {
    await writeFile(file, original);
    const visited: string[] = [];
    await assert.rejects(configureLocalDatabase(file, passwords, async (role: string) => {
      visited.push(role);
      if (role === 'northstar_migrator') throw new Error('Rejected');
    }));
    assert.deepEqual(visited, ['northstar_app', 'northstar_migrator']);
    assert.equal(await readFile(file, 'utf8'), original);
    await configureLocalDatabase(file, passwords, async (role: keyof typeof passwords, value: string) => {
      assert.equal(value, passwords[role]);
    });
    const saved = await readFile(file, 'utf8');
    const parsed = parseEnv(saved);
    for (const [key, role] of [['DATABASE_URL', 'northstar_app'], ['MIGRATION_DATABASE_URL', 'northstar_migrator']] as const) {
      assert.equal(saved.split(/\r?\n/).filter(line => line.startsWith(key + '=')).length, 1);
      const url = new URL(parsed[key]!);
      assert.equal(decodeURIComponent(url.password), passwords[role]);
      assert.equal(url.hostname, '127.0.0.1');
      assert.equal(url.port, '5432');
      assert.equal(url.pathname, '/northstar_db');
    }
    assert.equal(parsed.TOKEN_ENCRYPTION_KEY, 'keep-this');
    assert.deepEqual(await readdir(directory), ['.env']);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
