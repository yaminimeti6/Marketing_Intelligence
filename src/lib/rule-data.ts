import type {PoolClient} from 'pg';
import {aggregateMetrics} from './meta-report.ts';
import {type AnalyticsAccount,type AnalyticsData} from './analytics.ts';
import {shiftDay} from './meta-report.ts';
import type {RuleDefinition} from './alert-rules.ts';

export async function ruleAccounts(c:PoolClient):Promise<AnalyticsAccount[]>{
 const result:AnalyticsAccount[]=[];
 for(const provider of ['meta'] as const){const table='meta_ad_accounts';if(!(await c.query('SELECT to_regclass($1) IS NOT NULL AS ready',['public.'+table])).rows[0].ready)continue;
  const accounts=await c.query(`SELECT a.*,p.status AS connection_status,p.expires_at FROM ${table} a JOIN provider_connections p ON p.workspace_id=a.workspace_id AND p.id=a.connection_id WHERE a.accessible AND p.status<>'disconnected'  ORDER BY a.discovered_at DESC LIMIT 2001`);if(accounts.rows.length>2000)throw new Error('rule_report_limit');
  const seen=new Set<string>();for(const a of accounts.rows){const id=a.account_id;if(seen.has(id))continue;seen.add(id);result.push({key:`${provider}:${a.connection_id}:${id}`,connectionId:a.connection_id,id,name:a.name,currency:a.currency,timezone:a.timezone_name,lastSync:a.last_synced_at?.toISOString()??null,status:provider==='meta'&&a.expires_at&&a.expires_at<new Date()?'reauthorization_required':a.connection_status,provider});}
 }return result;
}
// Used inside a repeatable-read tenant transaction by both web actions and the worker.
export async function ruleAnalytics(c:PoolClient,rule:RuleDefinition,now=new Date()):Promise<AnalyticsData>{
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:rule.scope.split('|')[1],year:'numeric',month:'2-digit',day:'2-digit'}).format(now),start=shiftDay(today,-rule.days),end=shiftDay(today,-1);
 const data:AnalyticsData={today,accounts:await ruleAccounts(c),facts:[],entities:[],jobs:[],errors:[]};
 for(const provider of ['meta'] as const){
  const accounts=data.accounts.filter(a=>a.provider===provider&&(rule.provider==='all'||rule.provider===provider)&&`${a.currency}|${a.timezone}`===rule.scope&&(rule.account==='all'||a.key===rule.account)),keys=accounts.map(a=>a.key.slice(provider.length+1));if(!keys.length)continue;
  const id='account_id',entityTable='meta_entities';
  const entities=await c.query(`SELECT connection_id::text||':'||${id} AS account,entity_id,name,coalesce(effective_status,status) AS status FROM ${entityTable} WHERE level=$1 AND (connection_id::text||':'||${id})=ANY($2::text[]) LIMIT 10001`,['campaigns',keys]);
  const facts=await c.query(`SELECT connection_id::text||':'||${id} AS account,entity_id,date_start::text AS day,source FROM meta_insight_facts WHERE level='campaign' AND (connection_id::text||':'||${id})=ANY($1::text[]) AND date_start>=$2 AND date_stop<=$3 LIMIT 50001`,[keys,start,end]);
  if(entities.rows.length>10000||facts.rows.length>50000)throw new Error('rule_report_limit');
  for(const e of entities.rows)data.entities.push({key:`${provider}:${e.account}:${e.entity_id}`,accountKey:`${provider}:${e.account}`,id:e.entity_id,name:e.name,status:e.status,provider});
  for(const f of facts.rows){const accountKey=`${provider}:${f.account}`;{const m=aggregateMetrics([{accountKey,entityId:f.entity_id,level:'campaign',start:f.day,end:f.day,source:f.source}],true);data.facts.push({accountKey,entityKey:`${accountKey}:${f.entity_id}`,day:f.day,spend:m.spend,impressions:m.impressions,clicks:m.clicks,conversions:m.purchases,value:m.revenue});}}
  const jobs=await c.query(`SELECT connection_id::text||':'||(payload->>$1) AS account,payload->>'since' AS start,payload->>'until' AS "end",status,created_at,finished_at,last_error_code FROM sync_jobs WHERE provider=$2 AND (connection_id::text||':'||(payload->>$1))=ANY($3::text[]) AND payload->>'since'<=$5 AND payload->>'until'>=$4 ORDER BY created_at DESC LIMIT 2000`,['accountId',provider,keys,start,end]);
  for(const j of jobs.rows)data.jobs.push({accountKey:`${provider}:${j.account}`,start:j.start,end:j.end,status:j.status,created:j.created_at.toISOString(),finished:j.finished_at?.toISOString()??null,error:j.last_error_code});
 }return data;
}
