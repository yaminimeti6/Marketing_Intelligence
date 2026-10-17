import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
test('saved reports and export history are user/workspace scoped; viewers can record exports without changing audit history',async()=>{
 const db=new PGlite();try{
 await db.exec('CREATE ROLE northstar_app NOSUPERUSER NOBYPASSRLS');for(const f of ['001_foundation.sql','005_meta_reports.sql'])await db.exec(await readFile(new URL('../db/migrations/'+f,import.meta.url),'utf8'));
 const workspace=randomUUID(),user=randomUUID(),other=randomUUID(),id=randomUUID();await db.query("INSERT INTO workspaces(id,name) VALUES($1,'Test')",[workspace]);for(const u of [user,other]){await db.query("INSERT INTO users(id,email,name,password_hash) VALUES($1,$2,'Test','unused')",[u,u+'@example.test']);await db.query("INSERT INTO memberships VALUES($1,$2,'viewer')",[workspace,u]);}
 await db.exec('SET ROLE northstar_app');await db.query("SELECT set_config('app.user_id',$1,false),set_config('app.workspace_id',$2,false)",[user,workspace]);
 await db.query("INSERT INTO report_presets(workspace_id,id,user_id,name,filters) VALUES($1,$2,$3,'Weekly','{}')",[workspace,id,user]);await db.query("INSERT INTO report_exports(workspace_id,user_id,filters,row_count,complete) VALUES($1,$2,'{}',0,true)",[workspace,user]);assert.equal((await db.query('SELECT * FROM report_exports')).rows.length,1);await assert.rejects(()=>db.query('DELETE FROM report_exports'));await assert.rejects(()=>db.query("INSERT INTO report_presets(workspace_id,user_id,name,filters) VALUES($1,$2,'Denied','{}')",[workspace,other]));
 await db.query("SELECT set_config('app.user_id',$1,false)",[other]);assert.equal((await db.query('SELECT * FROM report_presets')).rows.length,0);assert.equal((await db.query('SELECT * FROM report_exports')).rows.length,0);assert.equal((await db.query('DELETE FROM report_presets WHERE id=$1 RETURNING id',[id])).rows.length,0);
 await db.query("SELECT set_config('app.user_id',$1,false),set_config('app.workspace_id',$2,false)",[user,randomUUID()]);assert.equal((await db.query('SELECT * FROM report_presets')).rows.length,0);
 }finally{await db.close();}
});
