import 'server-only';
import type {Session} from './auth';
import {withTenant} from './db';
export type SourceHealth={provider:string;stale:boolean;connected:number;records:number|null;lastSuccess:string|null;active:number;failed:number;latestError:string|null};
export async function loadSyncHealth(session:Session|null):Promise<SourceHealth[]>{
 if(!session)return [];
 return withTenant(session.userId,session.workspaceId,async c=>{
  const result:SourceHealth[]=[];
  for(const [provider,table] of [['meta','meta_insight_facts'],['shopify','shopify_records']]){
   const row=(await c.query(`SELECT (SELECT count(*)::int FROM provider_connections WHERE provider=$1 AND status='connected') AS connected,count(*) FILTER(WHERE status IN('queued','running'))::int AS active,count(*) FILTER(WHERE status IN('failed','dead') AND created_at>now()-interval '24 hours')::int AS failed,max(finished_at) FILTER(WHERE status='succeeded') AS success FROM sync_jobs WHERE provider=$1`,[provider])).rows[0];
   const latest=(await c.query("SELECT last_error_code FROM sync_jobs WHERE provider=$1 AND last_error_code IS NOT NULL AND status<>'succeeded' ORDER BY created_at DESC LIMIT 1",[provider])).rows[0];
   const exists=(await c.query('SELECT to_regclass($1) IS NOT NULL AS ready',['public.'+table])).rows[0].ready;
   const count=exists?Number((await c.query(`SELECT count(*) FROM ${table}`)).rows[0].count):null;
   result.push({provider,stale:!row.success||Date.now()-row.success.getTime()>120000,connected:row.connected,active:row.active,failed:row.failed,lastSuccess:row.success?.toISOString()??null,records:count,latestError:latest?.last_error_code??null});
  }return result;
 });
}
