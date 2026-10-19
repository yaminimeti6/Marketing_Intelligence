import 'server-only';
import {withTenant} from './db';
import type {Session} from './auth';
import type {Experiment} from '@/lib/experiments';
export async function loadExperiments(session:Session|null){
 const empty={ready:false,canManage:!!session&&['owner','admin'].includes(session.role),sources:[] as {id:string;name:string}[],experiments:[] as (Experiment&{aCount:number;bCount:number;aConversions:number;bConversions:number;conversionReady:boolean})[]};if(!session)return empty;
 try{return await withTenant(session.userId,session.workspaceId,async c=>{
  if(!(await c.query("SELECT to_regclass('public.storefront_experiments') IS NOT NULL AS ready")).rows[0].ready)return empty;
  if((await c.query('SELECT count(*)::int AS count FROM (SELECT 1 FROM experiment_exposures LIMIT 5001) x')).rows[0].count>5000)return empty;
  const sources=await c.query('SELECT p.id,s.name FROM shopify_pixel_sources p JOIN shopify_stores s ON s.connection_id=p.connection_id AND s.workspace_id=p.workspace_id WHERE p.enabled AND p.measurement_enabled');
  const experiments=await c.query(`SELECT e.id,e.name,e.kind,e.entry_path AS entry,e.variant_a AS a,e.variant_b AS b,e.status,e.started_at,e.ends_at,
   s.last_synced_at>now()-interval '15 minutes' AND (SELECT j.status FROM sync_jobs j WHERE j.workspace_id=e.workspace_id AND j.connection_id=p.connection_id AND j.provider='shopify' ORDER BY j.created_at DESC LIMIT 1)='succeeded' AS ready,
   coalesce(jsonb_agg(jsonb_build_object('variant',x.variant,'converted',EXISTS(SELECT 1 FROM journey_events v JOIN shopify_records r ON r.workspace_id=v.workspace_id AND r.connection_id=p.connection_id AND r.resource='orders' AND r.entity_id=v.order_id WHERE v.source_id=e.source_id AND v.visitor_hash=x.visitor_hash AND v.event_name='checkout_completed' AND v.occurred_at>=x.occurred_at AND v.occurred_at<=x.occurred_at+interval '7 days' AND r.source->>'test'='false' AND r.source->>'cancelledAt' IS NULL))) FILTER(WHERE x.visitor_hash IS NOT NULL),'[]') AS exposures
   FROM storefront_experiments e JOIN shopify_pixel_sources p ON p.id=e.source_id JOIN shopify_stores s ON s.workspace_id=e.workspace_id AND s.connection_id=p.connection_id
   LEFT JOIN experiment_exposures x ON x.experiment_id=e.id AND x.occurred_at<=now()-interval '7 days' AND x.received_at>=now()-interval '30 days'
   GROUP BY e.workspace_id,e.id,p.connection_id,s.last_synced_at ORDER BY e.created_at DESC LIMIT 30`);
  return {...empty,ready:true,sources:sources.rows,experiments:experiments.rows.map(r=>({...r,starts:r.started_at?.toISOString()??null,ends:r.ends_at?.toISOString()??null,conversionReady:r.ready===true,aCount:r.exposures.filter((x:{variant:string})=>x.variant==='A').length,bCount:r.exposures.filter((x:{variant:string})=>x.variant==='B').length,aConversions:r.exposures.filter((x:{variant:string;converted:boolean})=>x.variant==='A'&&x.converted).length,bConversions:r.exposures.filter((x:{variant:string;converted:boolean})=>x.variant==='B'&&x.converted).length}))};
 });}catch{return empty;}
}
export type ExperimentsPage=Awaited<ReturnType<typeof loadExperiments>>;
