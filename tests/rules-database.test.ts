import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFile,readdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import type {PoolClient} from 'pg';
import {saveRule,toggleRule,runRule,reviewAlert} from '../src/lib/rule-store.ts';
import {ruleAnalytics} from '../src/lib/rule-data.ts';
import {shiftDay} from '../src/lib/meta-report.ts';
import type {RuleDefinition} from '../src/lib/alert-rules.ts';
import {evaluateRule} from '../src/lib/alert-rules.ts';

test('Stored rules enforce tenant/role isolation, dry runs, cooldown, append-only snapshots and reviewed-alert permissions',async()=>{
 const db=new PGlite();try{
 await db.exec('CREATE ROLE northstar_app NOSUPERUSER NOBYPASSRLS');for(const f of (await readdir(new URL('../db/migrations/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort())await db.exec(await readFile(new URL('../db/migrations/'+f,import.meta.url),'utf8'));
 const workspace=randomUUID(),other=randomUUID(),owner=randomUUID(),analyst=randomUUID(),connection=randomUUID(),foreignConnection=randomUUID(),now=new Date(),today=now.toISOString().slice(0,10),yesterday=shiftDay(today,-1);
 await db.query("INSERT INTO workspaces(id,name) VALUES($1,'Main'),($2,'Other')",[workspace,other]);await db.query("INSERT INTO users(id,email,name,password_hash) VALUES($1,'owner@rules.test','Owner','unused'),($2,'analyst@rules.test','Analyst','unused')",[owner,analyst]);await db.query("INSERT INTO memberships VALUES($1,$2,'owner'),($1,$3,'analyst'),($4,$2,'owner')",[workspace,owner,analyst,other]);
 for(const [ws,conn] of [[workspace,connection],[other,foreignConnection]]){
  await db.query("INSERT INTO provider_connections(workspace_id,id,provider,external_id,status) VALUES($1,$2,'meta','fixture','connected')",[ws,conn]);await db.query("INSERT INTO meta_ad_accounts(workspace_id,connection_id,account_id,name,currency,timezone_name,last_synced_at) VALUES($1,$2,'1','Fixture','USD','UTC',$3)",[ws,conn,now]);
  await db.query("INSERT INTO meta_entities(workspace_id,connection_id,account_id,entity_id,level,name,status) VALUES($1,$2,'1','10','campaigns','Fixture campaign','ACTIVE')",[ws,conn]);
  await db.query("INSERT INTO meta_insight_facts(workspace_id,connection_id,account_id,entity_id,level,date_start,date_stop,api_version,source) VALUES($1,$2,'1','10','campaign',$3,$3,'fixture',$4)",[ws,conn,yesterday,JSON.stringify({spend:'101.000001',impressions:'100',clicks:'2',actions:[],action_values:[]})]);
  await db.query("INSERT INTO sync_jobs(workspace_id,connection_id,provider,dedupe_key,status,payload,finished_at) VALUES($1,$2,'meta','fixture','succeeded',$3,$4)",[ws,conn,JSON.stringify({accountId:'1',since:shiftDay(today,-7),until:today}),now]);
 }
 await db.exec('SET ROLE northstar_app');const context=(ws:string,user=owner)=>db.query("SELECT set_config('app.workspace_id',$1,false),set_config('app.user_id',$2,false)",[ws,user]);
 const c={query:async(sql:string,params?:unknown[])=>{const r=await db.query(sql,params);return {...r,rowCount:r.rows.length};}} as unknown as PoolClient;
 const tx=async<T>(fn:()=>Promise<T>)=>{await db.exec('BEGIN ISOLATION LEVEL REPEATABLE READ');try{const result=await fn();await db.exec('COMMIT');return result;}catch(e){await db.exec('ROLLBACK');throw e;}};
 const definition:RuleDefinition={name:'Fixture threshold',provider:'meta',scope:'USD|UTC',account:'all',days:7,logic:'all',conditions:[{metric:'spend',operator:'gt',threshold:'100'}],cooldownHours:1};
 await context(other);const foreign=await tx(()=>saveRule(c,definition,true));await context(workspace);const id=await tx(()=>saveRule(c,definition,false));
 const data=await tx(()=>ruleAnalytics(c,definition,now));assert.equal(data.accounts.filter(a=>a.provider==='meta').length,1);assert.equal(data.facts.length,1);assert.equal(data.facts[0].spend,'101.000001');
 const allDefinition={...definition,provider:'all' as const},all=await tx(()=>ruleAnalytics(c,allDefinition,now)),allResult=evaluateRule(allDefinition,all,now);assert.equal(all.facts.length,1);assert.equal(allResult.values.spend,'101.000001');assert.equal(allResult.status,'matched');
 const dry=await tx(()=>runRule(c,id,{dryRun:true,now}));assert.equal(dry.outcome,'dry_run');assert.equal(dry.result?.status,'matched');assert.equal((await db.query('SELECT * FROM rule_alerts')).rows.length,0);assert.equal((await db.query<{last_alert_at:Date|null}>('SELECT last_alert_at FROM alert_rules WHERE id=$1',[id])).rows[0].last_alert_at,null);
 assert.equal((await tx(()=>runRule(c,id,{now}))).outcome,'skipped');await tx(()=>toggleRule(c,id,true));
 const pending=randomUUID();await db.query("INSERT INTO sync_jobs(workspace_id,id,connection_id,provider,dedupe_key,status,payload,created_at) VALUES($1,$2,$3,'meta','pending-fixture','running',$4,now()+interval '1 second')",[workspace,pending,connection,JSON.stringify({accountId:'1',since:shiftDay(today,-7),until:today})]);
 const waiting=await tx(()=>runRule(c,id,{automatic:true,now}));assert.equal(waiting.result?.status,'unavailable');assert.equal((await db.query<{last_result:{retryAfterSeconds:number}}>('SELECT last_result FROM alert_rules WHERE id=$1',[id])).rows[0].last_result.retryAfterSeconds,10);
 assert.equal((await tx(()=>runRule(c,id,{automatic:true,now:new Date(now.getTime()+5000)}))).outcome,'skipped');
 await db.query("UPDATE sync_jobs SET status='succeeded' WHERE id=$1",[pending]);const afterImport=new Date(now.getTime()+11000);
 assert.equal((await tx(()=>runRule(c,id,{automatic:true,now:afterImport}))).outcome,'alert_created');assert.equal((await tx(()=>runRule(c,id,{now:afterImport}))).outcome,'cooldown');assert.equal((await tx(()=>runRule(c,id,{automatic:true,now:afterImport}))).outcome,'skipped');
 const logs=(await db.query('SELECT * FROM alert_rule_runs')).rows.length;assert.equal((await tx(()=>runRule(c,id,{automatic:true,now:new Date(now.getTime()+90000)}))).outcome,'cooldown');assert.equal((await db.query('SELECT * FROM alert_rule_runs')).rows.length,logs);
 await tx(()=>toggleRule(c,id,false));assert.equal((await tx(()=>runRule(c,id,{now:afterImport}))).outcome,'skipped');await tx(()=>toggleRule(c,id,true));assert.equal((await tx(()=>runRule(c,id,{now:afterImport}))).outcome,'cooldown');assert.equal((await db.query('SELECT * FROM rule_alerts')).rows.length,1);
 const alert=(await db.query<{id:string;result:unknown}>('SELECT id,result FROM rule_alerts')).rows[0];await tx(()=>reviewAlert(c,alert.id));assert.ok((await db.query<{reviewed_at:Date}>('SELECT reviewed_at FROM rule_alerts')).rows[0].reviewed_at);await assert.rejects(()=>tx(()=>db.query("UPDATE rule_alerts SET result='{}' WHERE id=$1",[alert.id])));await assert.rejects(()=>tx(()=>db.query('DELETE FROM alert_rule_runs')));
 const later=new Date(now.getTime()+2*3600000);await db.query('UPDATE meta_ad_accounts SET last_synced_at=$1',[later]);await tx(()=>saveRule(c,{...definition,name:'Updated fixture threshold'},true,id));assert.equal((await tx(()=>runRule(c,id,{now:later}))).outcome,'alert_created');assert.equal((await db.query('SELECT * FROM rule_alerts')).rows.length,2);assert.equal((await db.query<{rule_name:string}>('SELECT rule_name FROM rule_alerts WHERE id=$1',[alert.id])).rows[0].rule_name,'Fixture threshold');
 await assert.rejects(()=>tx(()=>runRule(c,foreign,{dryRun:true,now})),/rule_permission/);await assert.rejects(()=>tx(()=>saveRule(c,definition,true,foreign)),/rule_permission/);
 await context(workspace,analyst);assert.equal((await db.query('SELECT * FROM rule_alerts')).rows.length,2);await assert.rejects(()=>tx(()=>saveRule(c,definition,true)),/rule_permission/);await assert.rejects(()=>tx(()=>runRule(c,id,{dryRun:true,now})),/rule_permission/);await assert.rejects(()=>tx(()=>reviewAlert(c,alert.id)),/rule_permission/);assert.equal((await db.query('UPDATE alert_rules SET enabled=false RETURNING id')).rows.length,0);
 await context(other);assert.equal((await db.query('SELECT * FROM rule_alerts')).rows.length,0);assert.equal((await db.query('SELECT * FROM alert_rules')).rows.length,1);
 }finally{await db.close();}
});
