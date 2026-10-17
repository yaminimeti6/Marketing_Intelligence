import {salesReportQuery,salesWindow,salesStatement,parseSalesReport,type SalesReport} from './shopify-sales-report.ts';
import type { PoolClient } from 'pg';
import { ShopifyClient,ShopifyError,ShopifySession,shopifySdk,validateShopifySession } from './shopify.ts';
import type { ShopifyConfig } from './shopify-config.ts';
import { openToken,sealToken } from './security.ts';
type Transaction=<T>(operation:(client:PoolClient)=>Promise<T>)=>Promise<T>;
export type ShopifyJob={id:string;workspace_id:string;connection_id:string;lease_token:string;attempts:number;payload:{since?:string;until?:string}};
export async function executeShopifyJob(job:ShopifyJob,transaction:Transaction,config:ShopifyConfig,key:string,keyId:string){
 const {since,until}=job.payload;
 if(!since||!until||!/^\d{4}-\d{2}-\d{2}T/.test(since)||!Number.isFinite(Date.parse(since))||!Number.isFinite(Date.parse(until))||since>until)throw new ShopifyError('configuration');
 const token=await transaction(async c=>{
  // Lock connection and credential together: refresh-token rotation is serialized per store.
  const r=await c.query(`SELECT p.status,s.shop_domain,e.envelope,e.key_id FROM provider_connections p JOIN encrypted_credentials e ON e.workspace_id=p.workspace_id AND e.connection_id=p.id JOIN shopify_stores s ON s.workspace_id=p.workspace_id AND s.connection_id=p.id WHERE p.id=$1 AND p.provider='shopify' FOR UPDATE OF p,e`,[job.connection_id]);
  const row=r.rows[0];if(!row||row.status!=='connected'||row.shop_domain!==config.shop)throw new ShopifyError('reauthorization_required');
  if(row.key_id!==keyId)throw new ShopifyError('configuration');
  let session:ShopifySession;
  try{const raw=JSON.parse(openToken(row.envelope,`${job.workspace_id}:shopify:${job.connection_id}`,key));session=new ShopifySession({...raw,expires:new Date(raw.expires),refreshTokenExpires:new Date(raw.refreshTokenExpires)});}catch{throw new ShopifyError('configuration');}
  if(!session.expires||session.expires.getTime()<Date.now()+120000){
   if(!session.refreshToken||!session.refreshTokenExpires||session.refreshTokenExpires.getTime()<=Date.now())throw new ShopifyError('reauthorization_required');
   try{session=(await shopifySdk(config).auth.refreshToken({shop:config.shop,refreshToken:session.refreshToken})).session;}catch(error){const code=(error as {response?:{code?:number}})?.response?.code;throw new ShopifyError(code&&code>=400&&code<500&&code!==429?'reauthorization_required':code===429?'rate_limited':'unavailable');}
   validateShopifySession(session,config.shop);
   await c.query('UPDATE encrypted_credentials SET envelope=$1,updated_at=now() WHERE connection_id=$2',[sealToken(JSON.stringify(session.toObject()),`${job.workspace_id}:shopify:${job.connection_id}`,key),job.connection_id]);
   await c.query('UPDATE provider_connections SET expires_at=$1,scopes=$2 WHERE id=$3',[session.expires,session.scope!.split(','),job.connection_id]);
  }
  validateShopifySession(session,config.shop);return session.accessToken!;
 });
 const api=new ShopifyClient(config,token);const identity=await api.identity();
 const persist=(operation:(client:PoolClient)=>Promise<void>)=>transaction(async c=>{
  const lease=await c.query("UPDATE sync_jobs SET locked_at=now() WHERE id=$1 AND lease_token=$2 AND status='running' RETURNING id",[job.id,job.lease_token]);if(!lease.rowCount)throw new ShopifyError('unavailable');
  const connected=await c.query("SELECT id FROM provider_connections WHERE id=$1 AND status='connected' AND provider='shopify'",[job.connection_id]);if(!connected.rowCount)throw new ShopifyError('reauthorization_required');await operation(c);
 });
 for(const resource of ['orders','products'] as const){
  for await(const page of api.records(resource,since,until))await persist(async c=>{
   for(const row of page)await c.query(`INSERT INTO shopify_records(workspace_id,connection_id,resource,entity_id,source,api_version) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(workspace_id,connection_id,resource,entity_id) DO UPDATE SET source=$5,api_version=$6,synced_at=now()`,[job.workspace_id,job.connection_id,resource,row.id,JSON.stringify(row),config.version]);
  });
 }
 let salesReport:SalesReport;
 const range=salesWindow(identity.ianaTimezone);
 try{salesReport=parseSalesReport(await api.query(salesReportQuery,{query:salesStatement(range.from,range.to)}),range,identity.currencyCode,identity.ianaTimezone);}
 catch(error){salesReport={status:error instanceof ShopifyError?error.kind:'invalid_response',...range,currency:identity.currencyCode,timezone:identity.ianaTimezone,checkedAt:new Date().toISOString(),rows:[]};}
 // Optional permission: failure here must not disable successful order/product imports.
 let checkouts:Awaited<ReturnType<ShopifyClient['abandonedCheckouts']>>|undefined,checkoutStatus='succeeded';
 try{checkouts=await api.abandonedCheckouts(since,until);}catch(error){checkoutStatus=error instanceof ShopifyError?error.kind:'unavailable';}
 await persist(async c=>{
  await c.query(`INSERT INTO sync_cursors(workspace_id,connection_id,resource,cursor) VALUES($1,$2,'shopify:sales-report',$3) ON CONFLICT(workspace_id,connection_id,resource) DO UPDATE SET cursor=$3,updated_at=now()`,[job.workspace_id,job.connection_id,JSON.stringify(salesReport)]);
  if(checkouts){
   // Replace only a fully fetched creation-date window; recovered and removed rows cannot linger in this snapshot.
   await c.query('DELETE FROM shopify_abandoned_checkouts WHERE connection_id=$1 AND created_at>=$2 AND created_at<=$3',[job.connection_id,since,until]);
   for(const row of checkouts)await c.query(`INSERT INTO shopify_abandoned_checkouts(workspace_id,connection_id,entity_id,created_at,updated_at,completed_at,amount,currency) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(workspace_id,connection_id,entity_id) DO UPDATE SET created_at=$4,updated_at=$5,completed_at=$6,amount=$7,currency=$8,synced_at=now()`,[job.workspace_id,job.connection_id,row.id,row.createdAt,row.updatedAt,row.completedAt,row.amount,row.currency]);
  }
  await c.query(`INSERT INTO sync_cursors(workspace_id,connection_id,resource,cursor) VALUES($1,$2,'shopify:abandoned-import',$3) ON CONFLICT(workspace_id,connection_id,resource) DO UPDATE SET cursor=$3,updated_at=now()`,[job.workspace_id,job.connection_id,JSON.stringify({status:checkoutStatus,since,until,finishedAt:new Date().toISOString()})]);
  await c.query('UPDATE shopify_stores SET last_synced_at=now() WHERE connection_id=$1',[job.connection_id]);
  await c.query('UPDATE provider_connections SET last_success_at=now() WHERE id=$1',[job.connection_id]);
  await c.query(`INSERT INTO sync_cursors(workspace_id,connection_id,resource,cursor) VALUES($1,$2,'shopify:completed-import',$3) ON CONFLICT(workspace_id,connection_id,resource) DO UPDATE SET cursor=$3,updated_at=now()`,[job.workspace_id,job.connection_id,JSON.stringify({since,until,version:config.version,detailVersion:2,financialVersion:1,history:'provider-permitted orders; recent updated window'})]);
  await c.query("UPDATE sync_jobs SET status='succeeded',finished_at=now(),last_error_code=NULL,locked_at=NULL WHERE id=$1 AND lease_token=$2",[job.id,job.lease_token]);
 });
}
