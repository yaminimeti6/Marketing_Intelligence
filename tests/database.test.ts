import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('foundation migration enforces tenant reads, writes, missing context and membership',async()=>{
  const db=new PGlite();
  try {
    await db.exec('CREATE ROLE northstar_app NOSUPERUSER NOBYPASSRLS');
    await db.exec(await readFile(new URL('../db/migrations/001_foundation.sql',import.meta.url),'utf8'));
    const a='11111111-1111-4111-8111-111111111111', b='22222222-2222-4222-8222-222222222222';
    const user='33333333-3333-4333-8333-333333333333';
    await db.query('INSERT INTO workspaces(id,name) VALUES($1,\'A\'),($2,\'B\')',[a,b]);
    await db.query("INSERT INTO users(id,email,name,password_hash) VALUES($1,'owner@example.test','Owner','not-used')",[user]);
    await db.query("INSERT INTO memberships VALUES($1,$2,'owner')",[a,user]);
    await db.query("INSERT INTO provider_connections(workspace_id,provider,external_id) VALUES($1,'meta','account-a'),($2,'meta','account-b')",[a,b]);
    await db.exec('SET ROLE northstar_app');
    assert.equal((await db.query('SELECT * FROM provider_connections')).rows.length,0);
    await db.query("SELECT set_config('app.user_id',$1,false),set_config('app.workspace_id',$2,false)",[user,a]);
    const own=await db.query<{external_id:string}>('SELECT external_id FROM provider_connections');
    assert.deepEqual(own.rows,[{external_id:'account-a'}]);
    await assert.rejects(db.query("INSERT INTO provider_connections(workspace_id,provider,external_id) VALUES($1,'meta','intrusion')",[b]));
    assert.equal((await db.query('DELETE FROM provider_connections WHERE workspace_id=$1 RETURNING id',[b])).rows.length,0);
    await db.query("SELECT set_config('app.workspace_id',$1,false)",[b]);
    assert.equal((await db.query('SELECT * FROM provider_connections')).rows.length,0);
    await db.exec('BEGIN');
    await db.query("SELECT set_config('app.workspace_id',$1,true)",[a]);
    assert.equal((await db.query('SELECT * FROM provider_connections')).rows.length,1);
    await db.exec('COMMIT');
    assert.equal((await db.query('SELECT * FROM provider_connections')).rows.length,0);
    await db.exec('RESET ROLE');
    await db.query("UPDATE memberships SET role='viewer' WHERE user_id=$1",[user]);
    await db.exec('SET ROLE northstar_app');
    await db.query("SELECT set_config('app.workspace_id',$1,false)",[a]);
    assert.equal((await db.query('SELECT * FROM provider_connections')).rows.length,1);
    await assert.rejects(db.query("INSERT INTO provider_connections(workspace_id,provider,external_id) VALUES($1,'meta','viewer-write')",[a]));
    assert.equal((await db.query("UPDATE provider_connections SET status='connected' RETURNING id")).rows.length,0);
  } finally {await db.close();}
});
