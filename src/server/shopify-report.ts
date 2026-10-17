import type {SalesReport} from '@/lib/shopify-sales-report';
import 'server-only';
import {canManageIntegrations} from '@/lib/security';
import { withTenant } from './db';
import type { Session } from './auth';
import { summarizeShopify } from '@/lib/shopify-report';
import {productSales,dateFilter,type ProductSales} from '@/lib/shopify-products';
import type {AbandonedReport} from '@/lib/shopify-abandoned';
import {reconcileShopify,type Reconciliation} from '@/lib/shopify-reconciliation';
export type ShopifyActivity={configured:boolean;lastEvent:string|null;pageViews:number;views:number;cart:number;cartUnits:number;checkout:number;products:Record<string,{views:number;cart:number;cartUnits:number}>};
export type ShopifyReport={canSync?:boolean;available:boolean;from:string;to:string;stores:{id:string;name:string;domain:string;currency:string;timezone:string;reportAccess?:boolean;salesReport?:SalesReport;lastSync:string|null;since:string|null;until:string|null;ready:boolean;pending:boolean;sales:ProductSales;activity:ShopifyActivity;abandoned:AbandonedReport;reconciliation:Reconciliation;groups:ReturnType<typeof summarizeShopify>['groups'];products:number;excluded:number}[]};
export async function loadShopifyReport(session:Session|null,query:Record<string,string|undefined>={}):Promise<ShopifyReport>{
 let from=dateFilter(query.from),to=dateFilter(query.to);if(from&&to&&from>to){from='';to='';}
 const unavailable:ShopifyReport={available:false,stores:[],from,to};
 if(!session)return unavailable;
 try{return await withTenant(session.userId,session.workspaceId,async c=>{
  const stores=await c.query(`SELECT s.connection_id AS id,s.name,s.shop_domain AS domain,s.currency,s.timezone_name,s.last_synced_at,p.status,p.scopes,
   x.cursor,j.status AS job_status,
   CASE WHEN p.status='connected' AND s.last_synced_at IS NOT NULL AND j.status='succeeded' THEN
    (SELECT coalesce(jsonb_agg(jsonb_build_object('resource',r.resource,'source',r.source)),'[]'::jsonb) FROM shopify_records r WHERE r.connection_id=s.connection_id AND r.workspace_id=s.workspace_id)
   ELSE '[]'::jsonb END AS records
   FROM shopify_stores s JOIN provider_connections p ON p.id=s.connection_id AND p.workspace_id=s.workspace_id
   LEFT JOIN LATERAL (SELECT status FROM sync_jobs WHERE connection_id=s.connection_id AND workspace_id=s.workspace_id AND provider='shopify' ORDER BY created_at DESC LIMIT 1) j ON true
   LEFT JOIN sync_cursors x ON x.connection_id=s.connection_id AND x.workspace_id=s.workspace_id AND x.resource='shopify:completed-import' ORDER BY s.name`);
  const result:ShopifyReport={canSync:canManageIntegrations(session.role),available:true,stores:[],from,to};
  for(const store of stores.rows){
   let cursor:{since?:string;until?:string;detailVersion?:number;financialVersion?:number}={};try{cursor=typeof store.cursor==='string'?JSON.parse(store.cursor):store.cursor??{};}catch{}
   const ready=store.status==='connected'&&!!store.last_synced_at&&store.job_status==='succeeded';
   // Hide snapshots while pages are being updated or an import failed: partial imports are not totals.
   const summary=summarizeShopify(store.records);
   const sales=productSales(store.records,store.currency,store.timezone_name,ready&&cursor.detailVersion===2,from,to);
   const activity:ShopifyActivity={configured:false,lastEvent:null,pageViews:0,views:0,cart:0,cartUnits:0,checkout:0,products:{}};
   const schema=(await c.query("SELECT to_regclass('public.shopify_pixel_sources') IS NOT NULL AS ready")).rows[0].ready;
   if(schema){
    const source=(await c.query('SELECT id,enabled FROM shopify_pixel_sources WHERE connection_id=$1',[store.id])).rows[0];
    activity.configured=source?.enabled===true;
    if(source){
     const events=await c.query(`SELECT event_name,product_id,count(*)::int AS count,sum(quantity)::bigint AS units,max(received_at) AS latest FROM shopify_customer_events
      WHERE source_id=$1 AND ($2::date IS NULL OR (occurred_at AT TIME ZONE $4)::date>=$2::date) AND ($3::date IS NULL OR (occurred_at AT TIME ZONE $4)::date<=$3::date)
      GROUP BY event_name,product_id`,[source.id,from||null,to||null,store.timezone_name]);
     for(const row of events.rows){
      const count=Number(row.count);const received=row.latest?.toISOString();if(received&&(!activity.lastEvent||received>activity.lastEvent))activity.lastEvent=received;
      if(row.event_name==='page_viewed')activity.pageViews+=count;
      if(row.event_name==='product_viewed')activity.views+=count;
      if(row.event_name==='checkout_started')activity.checkout+=count;
      if(row.event_name==='product_added_to_cart'){activity.cart+=count;activity.cartUnits+=Number(row.units);}
      if(row.product_id){const product=activity.products[row.product_id]??={views:0,cart:0,cartUnits:0};if(row.event_name==='product_viewed')product.views+=count;if(row.event_name==='product_added_to_cart'){product.cart+=count;product.cartUnits+=Number(row.units);}}
     }
    }
   }
   const abandoned:AbandonedReport={status:'not_imported',checkedAt:null,since:null,until:null,rows:[]};
   const checkoutSchema=(await c.query("SELECT to_regclass('public.shopify_abandoned_checkouts') IS NOT NULL AS ready")).rows[0].ready;
   if(checkoutSchema){
    const snapshot=(await c.query(`WITH checkpoint AS(SELECT cursor::jsonb AS payload FROM sync_cursors WHERE connection_id=$1 AND resource='shopify:abandoned-import')
     SELECT payload,(SELECT coalesce(jsonb_agg(jsonb_build_object('id',a.entity_id,'createdAt',a.created_at,'updatedAt',a.updated_at,'completedAt',a.completed_at,'amount',a.amount::text,'currency',a.currency) ORDER BY a.created_at DESC,a.entity_id),'[]')
      FROM shopify_abandoned_checkouts a WHERE a.connection_id=$1 AND a.created_at>=(payload->>'since')::timestamptz AND a.created_at<=(payload->>'until')::timestamptz
      AND ($2::date IS NULL OR (a.created_at AT TIME ZONE $4)::date>=$2) AND ($3::date IS NULL OR (a.created_at AT TIME ZONE $4)::date<=$3)) AS records FROM checkpoint`,[store.id,from||null,to||null,store.timezone_name])).rows[0];
    if(snapshot){abandoned.status=ready?snapshot.payload.status:['queued','running'].includes(store.job_status)?'pending':'import_failed';abandoned.checkedAt=snapshot.payload.finishedAt??null;abandoned.since=snapshot.payload.since??null;abandoned.until=snapshot.payload.until??null;if(abandoned.status==='succeeded')abandoned.rows=snapshot.records;}
   }
   let salesReport:SalesReport|undefined;const salesRow=(await c.query("SELECT cursor FROM sync_cursors WHERE connection_id=$1 AND resource='shopify:sales-report'",[store.id])).rows[0];if(salesRow)try{salesReport=typeof salesRow.cursor==='string'?JSON.parse(salesRow.cursor):salesRow.cursor;}catch{}
   if(salesReport&&(!ready||!Array.isArray(store.scopes)||!store.scopes.includes('read_reports')))salesReport={...salesReport,status:'unavailable',rows:[]};
   const reconciliation=reconcileShopify(store.records,store.currency,store.timezone_name,ready&&cursor.financialVersion===1,from,to);
   result.stores.push({id:store.id,salesReport,reportAccess:Array.isArray(store.scopes)&&store.scopes.includes('read_reports'),name:store.name,domain:store.domain,currency:store.currency,timezone:store.timezone_name,lastSync:store.last_synced_at?.toISOString()??null,since:cursor.since??null,until:cursor.until??null,ready,pending:['queued','running'].includes(store.job_status),sales,activity,abandoned,reconciliation,...summary});
  }return result;
 });}catch{return unavailable;}
}
