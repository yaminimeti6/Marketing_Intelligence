import 'server-only';
import { cookies } from 'next/headers';
import { randomUUID } from 'node:crypto';
import { shopifyConfig } from '@/lib/shopify-config';
import { ShopifyClient,ShopifyError,shopifySdk,validateShopifySession,type ShopifySession } from '@/lib/shopify';
import { canManageIntegrations,hashToken,sealToken } from '@/lib/security';
import { sessionCookie,type Session } from './auth';
import { withTenant } from './db';
export function getShopifyConfig(){return shopifyConfig(process.env);}
async function browserSessionHash(){const token=(await cookies()).get(sessionCookie)?.value;if(!token)throw new ShopifyError('permission_denied');return hashToken(token);}
export async function beginShopify(session:Session,request:Request){
  if(!canManageIntegrations(session.role))throw new ShopifyError('permission_denied');
  const config=getShopifyConfig(),sessionHash=await browserSessionHash();
  const response:Response=await shopifySdk(config).auth.begin({shop:config.shop,callbackPath:new URL(config.redirectUri).pathname,isOnline:false,rawRequest:request});
  // Match the database's ten-minute nonce lifetime; keep SDK cookie values/signatures unchanged.
  const cookieValues=response.headers.getSetCookie();response.headers.delete('Set-Cookie');
  for(const value of cookieValues)response.headers.append('Set-Cookie',value.replace(/Expires=[^;]+/i,`Expires=${new Date(Date.now()+600000).toUTCString()}`));
  const location=response.headers.get('location');if(!location)throw new ShopifyError('invalid_response');
  const state=new URL(location).searchParams.get('state');if(!state)throw new ShopifyError('invalid_response');
  await withTenant(session.userId,session.workspaceId,async c=>{
    await c.query('DELETE FROM shopify_oauth_states WHERE user_id=$1 OR expires_at<now()',[session.userId]);
    await c.query("INSERT INTO shopify_oauth_states(workspace_id,state_hash,user_id,session_hash,shop_domain,expires_at) VALUES($1,$2,$3,$4,$5,now()+interval '10 minutes')",[session.workspaceId,hashToken(state),session.userId,sessionHash,config.shop]);
  });return response;
}
export async function consumeShopifyState(session:Session,state:string,shop:string){
  if(!canManageIntegrations(session.role)||!state||state.length>256)return false;
  const sessionHash=await browserSessionHash();
  return withTenant(session.userId,session.workspaceId,async c=>(await c.query('DELETE FROM shopify_oauth_states WHERE state_hash=$1 AND user_id=$2 AND session_hash=$3 AND shop_domain=$4 AND expires_at>now() RETURNING state_hash',[hashToken(state),session.userId,sessionHash,shop])).rowCount===1);
}
export async function saveShopifyAuthorization(session:Session,authorized:ShopifySession){
  if(!canManageIntegrations(session.role))throw new ShopifyError('permission_denied');
  const config=getShopifyConfig();validateShopifySession(authorized,config.shop);
  const identity=await new ShopifyClient(config,authorized.accessToken!).identity();
  const key=process.env.TOKEN_ENCRYPTION_KEY,keyId=process.env.TOKEN_ENCRYPTION_KEY_ID;if(!key||!keyId)throw new ShopifyError('configuration');
  await withTenant(session.userId,session.workspaceId,async c=>{
    const result=await c.query(`INSERT INTO provider_connections(workspace_id,provider,external_id,status,scopes,expires_at,last_success_at) VALUES($1,'shopify',$2,'connected',$3,$4,now()) ON CONFLICT(workspace_id,provider,external_id) DO UPDATE SET status='connected',scopes=$3,expires_at=$4,last_success_at=now() RETURNING id`,[session.workspaceId,config.shop,authorized.scope!.split(','),authorized.expires]);
    const id=result.rows[0].id;
    const envelope=sealToken(JSON.stringify(authorized.toObject()),`${session.workspaceId}:shopify:${id}`,key);
    await c.query(`INSERT INTO encrypted_credentials(workspace_id,connection_id,envelope,key_id) VALUES($1,$2,$3,$4) ON CONFLICT(workspace_id,connection_id) DO UPDATE SET envelope=$3,key_id=$4,updated_at=now()`,[session.workspaceId,id,envelope,keyId]);
    await c.query(`INSERT INTO shopify_stores(workspace_id,connection_id,shop_domain,name,currency,timezone_name) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(workspace_id,connection_id) DO UPDATE SET name=$4,currency=$5,timezone_name=$6,discovered_at=now()`,[session.workspaceId,id,config.shop,identity.name,identity.currencyCode,identity.ianaTimezone]);
    await c.query("INSERT INTO audit_events(workspace_id,actor_id,action) VALUES($1,$2,'shopify.authorized')",[session.workspaceId,session.userId]);
  });
}
export type ShopifyStatus={configured:boolean;schemaReady:boolean;canManage:boolean;available:boolean;stores:{id:string;name:string;domain:string;status:string;lastSync:string|null}[];jobs:{status:string;code:string|null}[]};
export async function shopifyStatus(session:Session|null):Promise<ShopifyStatus>{
  let configured=false;try{shopifySdk(getShopifyConfig());configured=true;}catch{}
  const result:ShopifyStatus={configured,schemaReady:false,canManage:!!session&&canManageIntegrations(session.role),available:true,stores:[],jobs:[]};
  if(!session)return result;
  try{return await withTenant(session.userId,session.workspaceId,async c=>{
    if(!(await c.query("SELECT to_regclass('public.shopify_stores') IS NOT NULL AS ready")).rows[0].ready)return result;result.schemaReady=true;
    const stores=await c.query("SELECT s.connection_id AS id,s.name,s.shop_domain AS domain,p.status,s.last_synced_at FROM shopify_stores s JOIN provider_connections p ON p.workspace_id=s.workspace_id AND p.id=s.connection_id ORDER BY s.name");
    result.stores=stores.rows.map(r=>({...r,lastSync:r.last_synced_at?.toISOString()??null,last_synced_at:undefined}));
    result.jobs=(await c.query("SELECT status,last_error_code AS code FROM sync_jobs WHERE provider='shopify' ORDER BY created_at DESC LIMIT 5")).rows;return result;
  });}catch{return {...result,available:false};}
}
export async function queueShopifySync(session:Session,id:string){
  if(!canManageIntegrations(session.role)||!/^[a-f0-9-]{36}$/i.test(id))throw new ShopifyError('permission_denied');
  const until=new Date().toISOString(),since=new Date(Date.now()-59*86400000).toISOString();
  await withTenant(session.userId,session.workspaceId,async c=>{
    const store=await c.query("SELECT s.connection_id FROM shopify_stores s JOIN provider_connections p ON p.workspace_id=s.workspace_id AND p.id=s.connection_id WHERE s.connection_id=$1 AND p.provider='shopify' AND p.status='connected' FOR UPDATE OF p",[id]);
    if(!store.rowCount)throw new ShopifyError('permission_denied');
    await c.query(`INSERT INTO sync_jobs(workspace_id,connection_id,provider,dedupe_key,payload) SELECT $1,$2,'shopify',$3,$4 WHERE NOT EXISTS(SELECT 1 FROM sync_jobs WHERE connection_id=$2 AND provider='shopify' AND status IN('queued','running'))`,[session.workspaceId,id,randomUUID(),JSON.stringify({since,until})]);
    await c.query("INSERT INTO audit_events(workspace_id,actor_id,action) VALUES($1,$2,'shopify.sync_requested')",[session.workspaceId,session.userId]);
  });
}
