import 'server-only';
import { cookies } from 'next/headers';
import { randomUUID } from 'node:crypto';
import { MetaClient, metaConfig, MetaError, type AdAccount } from '@/lib/meta';
import { canManageIntegrations, hashToken, newToken, sealToken } from '@/lib/security';
import { withTenant } from './db';
import { sessionCookie, type Session } from './auth';

export function getMetaConfig() { return metaConfig(process.env); }
export async function createMetaState(session:Session) {
  if(!canManageIntegrations(session.role))throw new MetaError('permission_denied');
  const token=(await cookies()).get(sessionCookie)?.value;
  if(!token)throw new MetaError('permission_denied');
  const state=newToken();
  await withTenant(session.userId,session.workspaceId,async c=>{
    await c.query('DELETE FROM meta_oauth_states WHERE user_id=$1 OR expires_at<now()',[session.userId]);
    await c.query("INSERT INTO meta_oauth_states(workspace_id,state_hash,user_id,session_hash,expires_at) VALUES($1,$2,$3,$4,now()+interval '10 minutes')",[session.workspaceId,hashToken(state),session.userId,hashToken(token)]);
  });
  return state;
}
export async function consumeMetaState(session:Session,state:string) {
  if(!canManageIntegrations(session.role)||!/^[A-Za-z0-9_-]{43}$/.test(state))return false;
  const token=(await cookies()).get(sessionCookie)?.value;if(!token)return false;
  return withTenant(session.userId,session.workspaceId,async c=>{
    const result=await c.query('DELETE FROM meta_oauth_states WHERE state_hash=$1 AND user_id=$2 AND session_hash=$3 AND expires_at>now() RETURNING state_hash',[hashToken(state),session.userId,hashToken(token)]);
    return result.rowCount===1;
  });
}
export async function saveMetaAuthorization(session:Session,code:string) {
  const config=getMetaConfig();
  const token=await new MetaClient(config).exchangeCode(code);
  const api=new MetaClient(config,token);
  const identity=await api.validateToken();
  const accounts:AdAccount[]=[];
  for await(const page of api.accounts())accounts.push(...page);
  if(accounts.some(a=>!a||!/^act_\d+$/.test(a.id)||!/^\d+$/.test(a.account_id)||a.id!==`act_${a.account_id}`||typeof a.name!=='string'))throw new MetaError('invalid_response');
  const key=process.env.TOKEN_ENCRYPTION_KEY,keyId=process.env.TOKEN_ENCRYPTION_KEY_ID;
  if(!key||!keyId)throw new MetaError('configuration');
  await withTenant(session.userId,session.workspaceId,async c=>{
    const connection=await c.query(`INSERT INTO provider_connections(workspace_id,provider,external_id,status,scopes,expires_at,last_success_at)
      VALUES($1,'meta',$2,'connected',$3,$4,now()) ON CONFLICT(workspace_id,provider,external_id)
      DO UPDATE SET status='connected',scopes=$3,expires_at=$4,last_success_at=now() RETURNING id`,[session.workspaceId,identity.userId,identity.scopes,identity.expiresAt]);
    const id=connection.rows[0].id;
    const envelope=sealToken(token,`${session.workspaceId}:meta:${id}`,key);
    await c.query(`INSERT INTO encrypted_credentials(workspace_id,connection_id,envelope,key_id) VALUES($1,$2,$3,$4)
      ON CONFLICT(workspace_id,connection_id) DO UPDATE SET envelope=$3,key_id=$4,updated_at=now()`,[session.workspaceId,id,envelope,keyId]);
    await c.query('UPDATE meta_ad_accounts SET accessible=false WHERE connection_id=$1',[id]);
    for(const a of accounts)await c.query(`INSERT INTO meta_ad_accounts(workspace_id,connection_id,account_id,name,currency,timezone_name,account_status)
      VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(workspace_id,connection_id,account_id)
      DO UPDATE SET name=$4,currency=$5,timezone_name=$6,account_status=$7,accessible=true,discovered_at=now()`,[session.workspaceId,id,a.account_id,a.name,a.currency??null,a.timezone_name??null,a.account_status??null]);
    await c.query("INSERT INTO audit_events(workspace_id,actor_id,action) VALUES($1,$2,'meta.authorized')",[session.workspaceId,session.userId]);
  });
  return accounts.length;
}

export type MetaStatus = { configured:boolean; schemaReady:boolean; canManage:boolean; connections:{id:string;status:string;expiresAt:string|null;lastDiscovery:string|null}[];accounts:{connectionId:string;id:string;name:string;currency:string|null;selected:boolean;lastSync:string|null}[];jobs:{status:string;code:string|null;createdAt:string}[] };
export async function metaStatus(session:Session|null):Promise<MetaStatus> {
  let configured=false;try{getMetaConfig();configured=true;}catch{}
  const result:MetaStatus={configured,schemaReady:false,canManage:!!session&&canManageIntegrations(session.role),connections:[],accounts:[],jobs:[]};
  if(!session)return result;
  return withTenant(session.userId,session.workspaceId,async c=>{
    const ready=await c.query("SELECT to_regclass('public.meta_ad_accounts') IS NOT NULL AS ready");
    if(!ready.rows[0].ready)return result;
    result.schemaReady=true;
    const connections=await c.query("SELECT id,status,expires_at,last_success_at FROM provider_connections WHERE provider='meta' ORDER BY created_at");
    result.connections=connections.rows.map(r=>({id:r.id,status:r.expires_at&&r.expires_at<new Date()?'reauthorization_required':r.status,expiresAt:r.expires_at?.toISOString()??null,lastDiscovery:r.last_success_at?.toISOString()??null}));
    const accounts=await c.query("SELECT a.connection_id,a.account_id,a.name,a.currency,a.selected,a.last_synced_at FROM meta_ad_accounts a JOIN provider_connections p ON p.workspace_id=a.workspace_id AND p.id=a.connection_id WHERE a.accessible AND p.status='connected' AND (p.expires_at IS NULL OR p.expires_at>now()) ORDER BY a.name");
    result.accounts=accounts.rows.map(r=>({connectionId:r.connection_id,id:r.account_id,name:r.name,currency:r.currency,selected:r.selected,lastSync:r.last_synced_at?.toISOString()??null}));
    const jobs=await c.query("SELECT status,last_error_code,created_at FROM sync_jobs WHERE provider='meta' ORDER BY created_at DESC LIMIT 5");
    result.jobs=jobs.rows.map(r=>({status:r.status,code:r.last_error_code,createdAt:r.created_at.toISOString()}));
    return result;
  });
}

export async function queueMetaSync(session:Session,selected:string[]) {
  if(!canManageIntegrations(session.role))throw new MetaError('permission_denied');
  const until=new Date().toISOString().slice(0,10),since=new Date(Date.now()-29*86400000).toISOString().slice(0,10);
  await withTenant(session.userId,session.workspaceId,async c=>{
    const accounts=await c.query("SELECT a.connection_id,a.account_id FROM meta_ad_accounts a JOIN provider_connections p ON p.workspace_id=a.workspace_id AND p.id=a.connection_id WHERE a.accessible AND p.status='connected' AND (p.expires_at IS NULL OR p.expires_at>now()) FOR UPDATE OF a");
    const allowed=new Set(accounts.rows.map(a=>`${a.connection_id}:${a.account_id}`));
    if(selected.some(a=>!allowed.has(a)))throw new MetaError('permission_denied');
    await c.query('UPDATE meta_ad_accounts SET selected=false');
    for(const a of accounts.rows){
      if(!selected.includes(`${a.connection_id}:${a.account_id}`))continue;
      await c.query('UPDATE meta_ad_accounts SET selected=true WHERE connection_id=$1 AND account_id=$2',[a.connection_id,a.account_id]);
      await c.query(`INSERT INTO sync_jobs(workspace_id,connection_id,provider,dedupe_key,payload)
        SELECT $1,$2,'meta',$3,$4 WHERE NOT EXISTS(SELECT 1 FROM sync_jobs WHERE connection_id=$2 AND provider='meta' AND status IN('queued','running') AND payload->>'accountId'=$5)`,[session.workspaceId,a.connection_id,randomUUID(),JSON.stringify({accountId:a.account_id,since,until}),a.account_id]);
    }
    await c.query("INSERT INTO audit_events(workspace_id,actor_id,action) VALUES($1,$2,'meta.sync_requested')",[session.workspaceId,session.userId]);
  });
}
