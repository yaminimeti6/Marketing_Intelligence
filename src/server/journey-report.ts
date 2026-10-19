import 'server-only';
import {withTenant} from './db';
import type {Session} from './auth';
import {journeyReport,type JourneyEvent,type MeasurementOrder} from '@/lib/journey-report';
export async function loadJourneyReport(session:Session|null){
 if(!session)return {error:'Sign in to view measurement data.',report:null,enabled:0};
 try{return await withTenant(session.userId,session.workspaceId,async c=>{
  const schema=await c.query("SELECT to_regclass('public.journey_events') IS NOT NULL AS ready");if(!schema.rows[0].ready)return {error:'Journey measurement migration is not installed.',report:null,enabled:0};
  const sources=await c.query('SELECT count(*)::int AS count FROM shopify_pixel_sources WHERE enabled AND measurement_enabled');
  const events=await c.query(`SELECT e.source_id::text AS source,e.visitor_hash AS visitor,e.customer_hash AS customer,e.event_name AS name,e.channel,e.order_id AS "order",e.occurred_at AS time FROM journey_events e JOIN workspaces w ON w.id=e.workspace_id WHERE e.received_at>=now()-w.browser_event_retention_days*interval '1 day' ORDER BY e.occurred_at LIMIT 5001`);
  const orders=await c.query(`SELECT p.id::text AS source,r.entity_id AS id,r.source->>'createdAt' AS time FROM shopify_records r JOIN shopify_pixel_sources p ON p.workspace_id=r.workspace_id AND p.connection_id=r.connection_id WHERE r.resource='orders' AND r.source->>'test'='false' AND (r.source->>'cancelledAt') IS NULL ORDER BY r.entity_id LIMIT 10001`);
  if(events.rows.length>5000||orders.rows.length>10000)return {error:'Measurement dataset exceeds this report limit. No partial totals are shown.',report:null,enabled:sources.rows[0].count};
  const rows=events.rows.map(r=>({...r,time:r.time.toISOString()})) as JourneyEvent[];return {error:null,report:journeyReport(rows,orders.rows as MeasurementOrder[]),enabled:sources.rows[0].count};
 });}catch{return {error:'Journey measurement is temporarily unavailable.',report:null,enabled:0};}
}
export type JourneyPage=Awaited<ReturnType<typeof loadJourneyReport>>;
