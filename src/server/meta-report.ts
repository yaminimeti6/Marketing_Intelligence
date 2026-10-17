import 'server-only';
import { withTenant } from './db';
import type { Session } from './auth';
import { canManageIntegrations } from '@/lib/security';
import { accountScope,reportQuery,selectReportAccounts,type MetaReport,type ReportAccount } from '@/lib/meta-report';

export async function loadMetaReport(session:Session|null,params:Record<string,string|undefined>):Promise<MetaReport> {
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const empty:MetaReport={asOf:new Date().toISOString(),accounts:[],facts:[],ranges:[],entities:[],jobs:[],query:reportQuery(params,today),schemaReady:false,rangeSchemaReady:false,error:null,canSync:!!session&&canManageIntegrations(session.role)};
  if(!session)return empty;
  try{return await withTenant(session.userId,session.workspaceId,async c=>{
    const schema=await c.query("SELECT to_regclass('public.meta_ad_accounts') IS NOT NULL AS base,to_regclass('public.meta_range_insights') IS NOT NULL AS ranges");
    if(!schema.rows[0].base)return empty;
    empty.schemaReady=true;empty.rangeSchemaReady=schema.rows[0].ranges;
    const accounts=await c.query(`SELECT a.connection_id,a.account_id,a.name,a.currency,a.timezone_name,a.last_synced_at,p.status,p.expires_at
      FROM meta_ad_accounts a JOIN provider_connections p ON p.workspace_id=a.workspace_id AND p.id=a.connection_id
      WHERE a.accessible AND p.provider='meta' AND p.status<>'disconnected' ORDER BY a.discovered_at DESC,a.account_id LIMIT 2001`);
    if(accounts.rows.length>2000){empty.error='Too many accounts to load safely. Narrow the workspace account access.';return empty;}
    const seen=new Set<string>();
    empty.accounts=accounts.rows.filter(r=>{if(seen.has(r.account_id))return false;seen.add(r.account_id);return true;}).map(r=>({key:`${r.connection_id}:${r.account_id}`,connectionId:r.connection_id,id:r.account_id,name:r.name,currency:r.currency,timezone:r.timezone_name,lastSync:r.last_synced_at?.toISOString()??null,status:r.expires_at&&r.expires_at<new Date()?'reauthorization_required':r.status} satisfies ReportAccount)).sort((a,b)=>a.name.localeCompare(b.name));
    const preliminary=selectReportAccounts(empty.accounts,empty.query);
    const timezone=preliminary[0]?.timezone;
    if(timezone){try{const localToday=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());empty.query=reportQuery(params,localToday);}catch{}}
    const selected=selectReportAccounts(empty.accounts,empty.query);
    if(empty.query.account!=='all'&&!empty.accounts.some(a=>a.key===empty.query.account)){empty.error='The selected account is unavailable in this workspace.';return empty;}
    if(empty.query.scope&&!empty.accounts.some(a=>accountScope(a)===empty.query.scope)){empty.error='The selected currency/timezone scope is unavailable.';return empty;}
    const keys=selected.map(a=>a.key);
    if(!keys.length)return empty;
    const q=empty.query;
    const start=q.compare?q.priorStart:q.start;
    const facts=await c.query(`SELECT connection_id::text||':'||account_id AS "accountKey",level,entity_id AS "entityId",date_start::text AS start,date_stop::text AS "end",source
      FROM meta_insight_facts WHERE (connection_id::text||':'||account_id)=ANY($1::text[]) AND date_start>=$2 AND date_stop<=$3 ORDER BY date_start LIMIT 50001`,[keys,start,q.end]);
    const entities=await c.query(`SELECT connection_id::text||':'||account_id AS "accountKey",entity_id AS id,level,name,campaign_id AS "campaignId",adset_id AS "adsetId",coalesce(effective_status,status) AS status,daily_budget::text AS "dailyBudget",lifetime_budget::text AS "lifetimeBudget"
      FROM meta_entities WHERE (connection_id::text||':'||account_id)=ANY($1::text[]) ORDER BY name LIMIT 10001`,[keys]);
    if(facts.rows.length>50000||entities.rows.length>10000){empty.error='This report is too large. Select one account or a shorter date range.';return empty;}
    empty.facts=facts.rows;empty.entities=entities.rows;
    const jobs=await c.query(`SELECT connection_id::text||':'||(payload->>'accountId') AS "accountKey",payload->>'since' AS start,payload->>'until' AS "end",status,created_at,finished_at,last_error_code
      FROM sync_jobs WHERE provider='meta' AND (connection_id::text||':'||(payload->>'accountId'))=ANY($1::text[]) AND payload->>'since'<=$3 AND payload->>'until'>=$2 ORDER BY created_at DESC LIMIT 2000`,[keys,start,q.end]);
    empty.jobs=jobs.rows.map(r=>({accountKey:r.accountKey,start:r.start,end:r.end,status:r.status,created:r.created_at.toISOString(),finished:r.finished_at?.toISOString()??null,error:r.last_error_code}));
    if(empty.rangeSchemaReady){const ranges=await c.query(`SELECT connection_id::text||':'||account_id AS "accountKey",level,entity_id AS "entityId",date_start::text AS start,date_stop::text AS "end",source
      FROM meta_range_insights WHERE (connection_id::text||':'||account_id)=ANY($1::text[]) AND ((date_start=$2 AND date_stop=$3) OR (date_start=$4 AND date_stop=$5)) LIMIT 20001`,[keys,q.start,q.end,q.priorStart,q.priorEnd]);
      if(ranges.rows.length>20000){empty.error='Range summaries exceed the safe report size. Select a single account.';empty.facts=[];empty.entities=[];return empty;}empty.ranges=ranges.rows;}
    return empty;
  });}catch{return {...empty,facts:[],entities:[],ranges:[],jobs:[],error:'Meta reporting data is temporarily unavailable. No demo data has been substituted.'};}
}
