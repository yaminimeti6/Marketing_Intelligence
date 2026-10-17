import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFile,readdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import type {PoolClient} from 'pg';
import {disconnectConnection} from '../src/lib/disconnect.ts';
import {scheduleImports} from '../src/lib/sync-scheduler.ts';

test('Automatic scheduling deduplicates accounts and disconnect stops jobs, erases credentials and prevents unauthorized changes',async()=>{
 const db=new PGlite();try{
 await db.exec('CREATE ROLE northstar_app NOSUPERUSER NOBYPASSRLS');for(const f of (await readdir(new URL('../db/migrations/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort())await db.exec(await readFile(new URL('../db/migrations/'+f,import.meta.url),'utf8'));
 const workspace=randomUUID(),other=randomUUID(),owner=randomUUID(),analyst=randomUUID(),connection=randomUUID(),foreign=randomUUID();
 await db.query("INSERT INTO workspaces(id,name) VALUES($1,'Workspace'),($2,'Other')",[workspace,other]);
 await db.query("INSERT INTO users(id,email,name,password_hash) VALUES($1,'owner@control.test','Owner','unused'),($2,'analyst@control.test','Analyst','unused')",[owner,analyst]);
 await db.query("INSERT INTO memberships VALUES($1,$2,'owner'),($1,$3,'analyst'),($4,$2,'owner')",[workspace,owner,analyst,other]);
 await db.query("INSERT INTO provider_connections(workspace_id,id,provider,external_id,status) VALUES($1,$2,'meta','test','connected'),($3,$4,'meta','foreign','connected')",[workspace,connection,other,foreign]);
 await db.query("INSERT INTO encrypted_credentials VALUES($1,$2,'sealed','key',now())",[workspace,connection]);
 await db.query("INSERT INTO meta_ad_accounts(workspace_id,connection_id,account_id,name,currency,timezone_name,selected) VALUES($1,$2,'123','Test','INR','Asia/Kolkata',true)",[workspace,connection]);
 await db.exec('SET ROLE northstar_app');await db.query("SELECT set_config('app.user_id',$1,false),set_config('app.workspace_id',$2,false)",[owner,workspace]);
 const c={query:async(sql:string,params?:unknown[])=>{const result=await db.query(sql,params);return {...result,rowCount:result.rows.length};}} as unknown as PoolClient;
 assert.equal(await scheduleImports(c,'meta'),1);assert.equal(await scheduleImports(c,'meta'),0);assert.equal((await db.query('SELECT * FROM sync_jobs')).rows.length,1);
 await assert.rejects(()=>disconnectConnection(c,foreign));
 await db.query("SELECT set_config('app.user_id',$1,false)",[analyst]);
 assert.equal((await db.query('SELECT * FROM provider_connections')).rows.length,1);await assert.rejects(()=>disconnectConnection(c,connection));await assert.rejects(()=>scheduleImports(c,'meta'));
 await db.query("SELECT set_config('app.user_id',$1,false)",[owner]);await disconnectConnection(c,connection);
 assert.equal((await db.query('SELECT * FROM encrypted_credentials')).rows.length,0);assert.equal((await db.query<{status:string}>('SELECT status FROM sync_jobs')).rows[0].status,'dead');assert.equal(await scheduleImports(c,'meta'),0);
 assert.equal((await db.query<{status:string}>('SELECT status FROM provider_connections')).rows[0].status,'disconnected');
 await disconnectConnection(c,connection);assert.equal((await db.query("SELECT * FROM audit_events WHERE action='meta.disconnected'")).rows.length,1);
 }finally{await db.close();}
});
