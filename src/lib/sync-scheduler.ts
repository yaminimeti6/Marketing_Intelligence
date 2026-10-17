import type {PoolClient} from 'pg';
import {randomUUID} from 'node:crypto';
import {shiftDay} from './meta-report.ts';
export type SyncProvider='meta'|'shopify';
export async function scheduleImports(c:PoolClient,provider:SyncProvider,intervalSeconds=60,now=new Date()){
 if(!['meta','shopify'].includes(provider)||!Number.isFinite(intervalSeconds)||intervalSeconds<60||intervalSeconds>86400)throw new Error('invalid_schedule');
 const identity=await c.query("SELECT workspace_id,user_id FROM memberships WHERE workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid AND user_id=nullif(current_setting('app.user_id',true),'')::uuid AND role IN('owner','admin')");
 if(!identity.rowCount)throw new Error('permission_denied');const workspace=identity.rows[0].workspace_id;
 await c.query('SELECT pg_advisory_xact_lock(hashtext($1),hashtext($2))',[workspace,'scheduled:'+provider]);
 const table=provider==='meta'?'meta_ad_accounts':'shopify_stores';
 if(!(await c.query('SELECT to_regclass($1) IS NOT NULL AS ready',['public.'+table])).rows[0].ready)return 0;
 const sources=await c.query(`SELECT a.*,p.id AS connection FROM ${table} a JOIN provider_connections p ON p.workspace_id=a.workspace_id AND p.id=a.connection_id WHERE p.provider=$1 AND p.status='connected' AND EXISTS(SELECT 1 FROM encrypted_credentials e WHERE e.connection_id=p.id AND e.workspace_id=p.workspace_id) ${provider==='shopify'?'':"AND a.accessible AND a.selected"}  ${provider==='meta'?"AND (p.expires_at IS NULL OR p.expires_at>now())":''}`,[provider]);
 let count=0;
 for(const source of sources.rows){
  const account=provider==='meta'?source.account_id:null,field=provider==='meta'?'accountId':'customerId';
  const pending=await c.query(`SELECT 1 FROM sync_jobs WHERE connection_id=$1 AND provider=$2 AND ($3::text IS NULL OR payload->>$4=$3) AND (status IN('queued','running') OR created_at>now()-($5*interval '1 second')) LIMIT 1`,[source.connection,provider,account,field,intervalSeconds]);if(pending.rowCount)continue;
  let payload:Record<string,string>;
  if(provider==='shopify')payload={since:new Date(now.getTime()-59*86400000).toISOString(),until:now.toISOString()};
  else {let today:string;try{today=new Intl.DateTimeFormat('en-CA',{timeZone:source.timezone_name,year:'numeric',month:'2-digit',day:'2-digit'}).format(now);}catch{continue;}payload={[field]:account,since:shiftDay(today,-29),until:today};}
  await c.query("INSERT INTO sync_jobs(workspace_id,connection_id,provider,dedupe_key,payload) VALUES($1,$2,$3,$4,$5)",[workspace,source.connection,provider,'scheduled:'+randomUUID(),JSON.stringify(payload)]);count++;
 }
 if(provider==='shopify'&&(await c.query("SELECT to_regprocedure('public.shopify_purge_retained_events()') IS NOT NULL AS ready")).rows[0].ready)await c.query('SELECT shopify_purge_retained_events()');
 return count;
}
