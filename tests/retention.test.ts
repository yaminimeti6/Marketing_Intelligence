import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFile,readdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {hashToken} from '../src/lib/security.ts';
test('Retention changes require a current Owner session and purge only expired events in that workspace; Analyst invitations remain restricted',async()=>{
 const db=new PGlite();try{
 await db.exec('CREATE ROLE northstar_app NOSUPERUSER NOBYPASSRLS');for(const f of (await readdir(new URL('../db/migrations/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort())await db.exec(await readFile(new URL('../db/migrations/'+f,import.meta.url),'utf8'));
 const ws=randomUUID(),other=randomUUID(),owner=randomUUID(),analyst=randomUUID(),session=hashToken('owner-session'),analystSession=hashToken('analyst-session');
 await db.query("INSERT INTO workspaces(id,name) VALUES($1,'Main'),($2,'Other')",[ws,other]);await db.query("INSERT INTO users(id,email,name,password_hash) VALUES($1,'owner@retention.test','Owner','unused'),($2,'analyst@retention.test','Analyst','unused')",[owner,analyst]);await db.query("INSERT INTO memberships VALUES($1,$2,'owner'),($1,$3,'analyst'),($4,$2,'owner')",[ws,owner,analyst,other]);
 await db.query("INSERT INTO sessions(token_hash,user_id,workspace_id,expires_at) VALUES($1,$2,$3,now()+interval '1 hour'),($4,$5,$3,now()+interval '1 hour')",[session,owner,ws,analystSession,analyst]);
 for(const [workspace,key] of [[ws,'a'],[other,'b']]){const connection=randomUUID(),source=randomUUID();await db.query("INSERT INTO provider_connections(workspace_id,id,provider,external_id,status) VALUES($1,$2,'shopify',$3,'connected')",[workspace,connection,key+'.myshopify.com']);await db.query("INSERT INTO shopify_stores(workspace_id,connection_id,shop_domain,name,currency,timezone_name) VALUES($1,$2,$3,'Test','INR','Asia/Kolkata')",[workspace,connection,key+'.myshopify.com']);await db.query('INSERT INTO shopify_pixel_sources(id,workspace_id,connection_id,key_hash,created_by) VALUES($1,$2,$3,$4,$5)',[source,workspace,connection,key.repeat(64),owner]);for(const [hash,age] of [['c',40],['d',5]] as const)await db.query("INSERT INTO shopify_customer_events(source_id,workspace_id,event_hash,event_name,quantity,occurred_at,received_at) VALUES($1,$2,$3,'page_viewed',1,now()-($4*interval '1 day'),now()-($4*interval '1 day'))",[source,workspace,hash.repeat(64),age]);}
 await db.exec('SET ROLE northstar_app');const context=(user:string,browser:string)=>db.query("SELECT set_config('app.workspace_id',$1,false),set_config('app.user_id',$2,false),set_config('app.session_hash',$3,false)",[ws,user,browser]);
 await context(analyst,analystSession);await assert.rejects(()=>db.query('SELECT save_event_retention(30)'),/retention_permission/);await assert.rejects(()=>db.query('SELECT shopify_purge_retained_events()'),/retention_permission/);
 await context(owner,'wrong-session');await assert.rejects(()=>db.query('SELECT save_event_retention(30)'),/retention_permission/);
 await context(owner,session);await assert.rejects(()=>db.query('SELECT save_event_retention(1)'),/retention_input/);assert.equal((await db.query<{n:number}>('SELECT save_event_retention(30) AS n')).rows[0].n,1);assert.equal((await db.query('SELECT * FROM shopify_customer_events')).rows.length,1);assert.equal((await db.query<{days:number}>('SELECT browser_event_retention_days AS days FROM workspaces WHERE id=$1',[ws])).rows[0].days,30);
 await db.query('SELECT team_manage($1,$2)',['invite',JSON.stringify({email:'new-analyst@retention.test',role:'analyst',token_hash:hashToken('analyst-invite')})]);assert.equal((await db.query<{role:string}>('SELECT team_invite_target($1)->>\'role\' AS role',[hashToken('analyst-invite')])).rows[0].role,'analyst');
 await db.query("SELECT set_config('app.workspace_id',$1,false)",[other]);assert.equal((await db.query('SELECT * FROM shopify_customer_events')).rows.length,2);assert.equal((await db.query<{days:number}>('SELECT browser_event_retention_days AS days FROM workspaces WHERE id=$1',[other])).rows[0].days,90);
 }finally{await db.close();}
});
