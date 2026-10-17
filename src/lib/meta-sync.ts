import type { PoolClient } from 'pg';
import { MetaClient, MetaError, type MetaInsight, type MetaConfig } from './meta.ts';
import { openToken } from './security.ts';

type Transaction = <T>(operation:(client:PoolClient)=>Promise<T>)=>Promise<T>;
export type MetaJob = {id:string;workspace_id:string;connection_id:string;lease_token:string;attempts:number;payload:{accountId?:string;since?:string;until?:string}};
export async function executeMetaJob(job:MetaJob,transaction:Transaction,config:MetaConfig,key:string,keyId:string) {
  const {accountId,since,until}=job.payload;
  if(!accountId||!/^\d+$/.test(accountId)||!since||!until)throw new MetaError('configuration');
  const context=await transaction(async c=>{
    const result=await c.query(`SELECT p.status,p.expires_at,e.envelope,e.key_id,a.currency,a.timezone_name
      FROM provider_connections p JOIN encrypted_credentials e ON e.workspace_id=p.workspace_id AND e.connection_id=p.id
      JOIN meta_ad_accounts a ON a.workspace_id=p.workspace_id AND a.connection_id=p.id
      WHERE p.id=$1 AND p.provider='meta' AND a.account_id=$2 AND a.accessible AND a.selected`,[job.connection_id,accountId]);
    const r=result.rows[0];
    if(!r||r.status!=='connected'||(r.expires_at&&r.expires_at<new Date()))throw new MetaError('reauthorization_required');
    if(r.key_id!==keyId)throw new MetaError('configuration');
    return r;
  });
  let token:string;
  try{token=openToken(context.envelope,`${job.workspace_id}:meta:${job.connection_id}`,key);}catch{throw new MetaError('configuration');}
  const api=new MetaClient(config,token);
  await api.validateToken();
  const persist=async (operation:(c:PoolClient)=>Promise<void>)=>transaction(async c=>{
    const lease=await c.query("UPDATE sync_jobs SET locked_at=now() WHERE id=$1 AND lease_token=$2 AND status='running' RETURNING id",[job.id,job.lease_token]);
    if(!lease.rowCount)throw new MetaError('unavailable');
    const selected=await c.query('SELECT account_id FROM meta_ad_accounts WHERE connection_id=$1 AND account_id=$2 AND selected AND accessible',[job.connection_id,accountId]);
    if(!selected.rowCount)throw new MetaError('permission_denied');
    await operation(c);
  });
  for(const level of ['campaigns','adsets','ads'] as const){
    for await(const page of api.entities(accountId,level))await persist(async c=>{
      for(const entity of page){
        if(!entity||!/^\d+$/.test(entity.id)||typeof entity.name!=='string'||(entity.daily_budget&&!/^\d+$/.test(entity.daily_budget))||(entity.lifetime_budget&&!/^\d+$/.test(entity.lifetime_budget)))throw new MetaError('invalid_response');
        await c.query(`INSERT INTO meta_entities(workspace_id,connection_id,account_id,level,entity_id,name,campaign_id,adset_id,status,effective_status,daily_budget,lifetime_budget)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT(workspace_id,connection_id,account_id,level,entity_id)
          DO UPDATE SET name=$6,campaign_id=$7,adset_id=$8,status=$9,effective_status=$10,daily_budget=$11,lifetime_budget=$12,synced_at=now()`,
          [job.workspace_id,job.connection_id,accountId,level,entity.id,entity.name,entity.campaign_id??null,entity.adset_id??null,entity.status??null,entity.effective_status??null,entity.daily_budget??null,entity.lifetime_budget??null]);
      }
    });
  }
  for(const level of ['campaign','adset','ad'] as const){
    const seen:string[]=[];
    for await(const page of api.insights(accountId,level,since,until))await persist(async c=>{
      for(const row of page){
        const entityId=level==='campaign'?row.campaign_id:level==='adset'?row.adset_id:row.ad_id;
        if(!entityId||!/^\d+$/.test(entityId)||row.account_id!==accountId||!/^\d{4}-\d{2}-\d{2}$/.test(row.date_start)||!/^\d{4}-\d{2}-\d{2}$/.test(row.date_stop)||row.date_start<since||row.date_stop>until)throw new MetaError('invalid_response');
        seen.push(`${entityId}|${row.date_start}|${row.date_stop}`);
        await c.query(`INSERT INTO meta_insight_facts(workspace_id,connection_id,account_id,level,entity_id,date_start,date_stop,currency,timezone_name,api_version,source)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT(workspace_id,connection_id,account_id,level,entity_id,date_start,date_stop,attribution_settings)
          DO UPDATE SET source=$11,currency=$8,timezone_name=$9,api_version=$10,synced_at=now()`,[job.workspace_id,job.connection_id,accountId,level,entityId,row.date_start,row.date_stop,context.currency,context.timezone_name,config.version,JSON.stringify(row)]);
      }
    });
    // Remove source rows no longer returned after a complete successful refresh.
    // On an interrupted API read this cleanup is never reached.
    await persist(async c=>{await c.query("DELETE FROM meta_insight_facts WHERE connection_id=$1 AND account_id=$2 AND level=$3 AND date_start>=$4 AND date_stop<=$5 AND NOT ((entity_id||'|'||date_start::text||'|'||date_stop::text)=ANY($6::text[]))",[job.connection_id,accountId,level,since,until,seen]);});
  }
  const summarySchema=await transaction(async c=>(await c.query("SELECT to_regclass('public.meta_range_insights') IS NOT NULL AS ready")).rows[0].ready);
  if(summarySchema)for(const level of ['account','campaign','adset','ad'] as const){
    const summaries:MetaInsight[]=[];
    for await(const page of api.insights(accountId,level,since,until,false)){
      summaries.push(...page);if(summaries.length>50000)throw new MetaError('configuration');
    }
    await persist(async c=>{
      await c.query('DELETE FROM meta_range_insights WHERE connection_id=$1 AND account_id=$2 AND level=$3 AND date_start=$4 AND date_stop=$5',[job.connection_id,accountId,level,since,until]);
      for(const row of summaries){
        const entityId=level==='account'?accountId:level==='campaign'?row.campaign_id:level==='adset'?row.adset_id:row.ad_id;
        if(!entityId||!/^\d+$/.test(entityId)||row.account_id!==accountId)throw new MetaError('invalid_response');
        await c.query(`INSERT INTO meta_range_insights(workspace_id,connection_id,account_id,level,entity_id,date_start,date_stop,source,currency,timezone_name,api_version)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,[job.workspace_id,job.connection_id,accountId,level,entityId,since,until,JSON.stringify(row),context.currency,context.timezone_name,config.version]);
      }
    });
  }
  await persist(async c=>{
    await c.query('UPDATE meta_ad_accounts SET last_synced_at=now() WHERE connection_id=$1 AND account_id=$2',[job.connection_id,accountId]);
    await c.query(`INSERT INTO sync_cursors(workspace_id,connection_id,resource,cursor) VALUES($1,$2,$3,$4)
      ON CONFLICT(workspace_id,connection_id,resource) DO UPDATE SET cursor=$4,updated_at=now()`,[job.workspace_id,job.connection_id,`meta:${accountId}:completed-range`,JSON.stringify({since,until,version:config.version})]);
    await c.query("UPDATE sync_jobs SET status='succeeded',finished_at=now(),last_error_code=NULL,locked_at=NULL WHERE id=$1 AND lease_token=$2",[job.id,job.lease_token]);
  });
}
