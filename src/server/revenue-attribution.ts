import 'server-only';import type {Session} from './auth';import {withTenant} from './db';import {revenueAttribution,type RevenueOrder} from '@/lib/revenue-attribution';import type {JourneyEvent} from '@/lib/journey-report';import {reconcileShopify} from '@/lib/shopify-reconciliation';
export async function loadRevenueAttribution(session:Session|null,store=''){
 const empty={error:'Sign in to view revenue attribution.',stores:[] as {id:string;name:string}[],store:'',result:null as ReturnType<typeof revenueAttribution>|null,fresh:false};if(!session)return empty;
 try{return await withTenant(session.userId,session.workspaceId,async c=>{const stores=(await c.query('SELECT connection_id AS id,name,currency,timezone_name,last_synced_at FROM shopify_stores ORDER BY name')).rows;const selected=store?stores.find(s=>s.id===store):stores[0];if(!selected)return {...empty,error:'Choose an accessible store.',stores};
 const events=(await c.query("SELECT e.source_id::text AS source,e.visitor_hash AS visitor,e.customer_hash AS customer,e.event_name AS name,e.channel,e.order_id AS \"order\",e.occurred_at AS time FROM journey_events e JOIN shopify_pixel_sources p ON p.id=e.source_id JOIN workspaces w ON w.id=e.workspace_id WHERE p.connection_id=$1 AND e.received_at>=now()-w.browser_event_retention_days*interval '1 day' ORDER BY e.occurred_at LIMIT 5001",[selected.id])).rows;
 const records=(await c.query("SELECT resource,source FROM shopify_records WHERE connection_id=$1 AND resource='orders' LIMIT 10001",[selected.id])).rows;
 const sources=(await c.query('SELECT id::text FROM shopify_pixel_sources WHERE connection_id=$1 ORDER BY created_at',[selected.id])).rows;
 if(events.length>5000||records.length>10000||sources.length>1)return {...empty,stores,store:selected.id,error:'Dataset exceeds the safe limit or has multiple identity sources. No partial attribution is shown.'};
 const source=sources[0]?.id??'unmatched';const financial=reconcileShopify(records,selected.currency,selected.timezone_name,true);const orders:RevenueOrder[]=financial.orders.filter(o=>!o.cancelled&&['PAID','PARTIALLY_REFUNDED','REFUNDED'].includes(o.paymentStatus)).map(o=>({source,id:o.id,time:o.createdAt,currency:o.currency,amount:o.values.items}));
 const last=selected.last_synced_at?.getTime()??0;const fresh=Date.now()-last<=900000&&last<=Date.now()+60000;
 return {error:null,stores:stores.map(s=>({id:s.id,name:s.name})),store:selected.id,fresh,result:fresh?revenueAttribution(events.map(e=>({...e,time:e.time.toISOString()})) as JourneyEvent[],orders):null};
 });}catch{return {...empty,error:'Revenue measurement is temporarily unavailable.'};}
}
export type RevenuePage=Awaited<ReturnType<typeof loadRevenueAttribution>>;
