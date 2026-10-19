import 'server-only';
import {withTenant} from './db';
import type {Session} from './auth';
import {operationInput,type OperationKind,type OperationPayload,type OperationSnapshot,MetaWriter,MetaWriteError} from '@/lib/meta-operations';
import {metaConfig,MetaClient} from '@/lib/meta';
import {openToken} from '@/lib/security';
export async function loadMetaOperations(session:Session|null){
 const empty={ready:false,canManage:!!session&&['owner','admin'].includes(session.role),writesEnabled:process.env.META_AD_WRITES_ENABLED==='true',accounts:[] as {key:string;name:string;currency:string;canWrite:boolean}[],operations:[] as {id:string;kind:OperationKind;currency:string;account:string;connection:string;payload:OperationPayload;status:string;created:string;items:{id:string;target:string|null;snapshot:OperationSnapshot;state:string;error:string|null;result:string|null}[]}[]};if(!session)return empty;
 try{return await withTenant(session.userId,session.workspaceId,async c=>{
  const accounts=await c.query("SELECT a.connection_id::text||':'||a.account_id AS key,a.name,a.currency,p.scopes @> ARRAY['ads_management']::text[] AS write FROM meta_ad_accounts a JOIN provider_connections p ON p.workspace_id=a.workspace_id AND p.id=a.connection_id WHERE a.accessible AND p.provider='meta' AND p.status='connected' AND (p.expires_at IS NULL OR p.expires_at>now()) ORDER BY a.name");
  empty.accounts=accounts.rows.map(r=>({key:r.key,name:r.name,currency:r.currency??'Unknown',canWrite:r.write===true}));
  if(!(await c.query("SELECT to_regclass('public.meta_operations') IS NOT NULL AS ready")).rows[0].ready)return empty;
  const operations=await c.query(`SELECT o.id,o.kind,o.currency,o.account_id AS account,o.connection_id AS connection,o.payload,o.status,o.created_at,coalesce(jsonb_agg(jsonb_build_object('id',i.id,'target',i.target_id,'snapshot',i.snapshot,'state',i.state,'error',i.error_code,'result',i.result_id) ORDER BY i.id) FILTER(WHERE i.id IS NOT NULL),'[]') AS items FROM meta_operations o LEFT JOIN meta_operation_items i ON i.workspace_id=o.workspace_id AND i.operation_id=o.id GROUP BY o.workspace_id,o.id ORDER BY o.created_at DESC LIMIT 20`);
  return {...empty,ready:true,operations:operations.rows.map(r=>({...r,created:r.created_at.toISOString()})) as typeof empty.operations};
 });}catch{return empty;}
}
export type MetaOperationsPage=Awaited<ReturnType<typeof loadMetaOperations>>;
export async function draftMetaOperation(session:Session,form:FormData){
 if(!['owner','admin'].includes(session.role))throw Error('Only owners and admins can draft Meta changes.');
 return withTenant(session.userId,session.workspaceId,async c=>{
  await c.query('SELECT pg_advisory_xact_lock(hashtext($1))',['meta-operations:'+session.workspaceId]);
  if((await c.query("SELECT count(*)::int AS count FROM meta_operations WHERE created_at>now()-interval '1 hour'")).rows[0].count>=10)throw Error('Draft limit reached. Try later.');
  const account=(await c.query("SELECT a.connection_id,a.account_id,a.currency FROM meta_ad_accounts a JOIN provider_connections p ON p.workspace_id=a.workspace_id AND p.id=a.connection_id WHERE a.connection_id::text||':'||a.account_id=$1 AND a.accessible AND p.status='connected'",[String(form.get('account'))])).rows[0];
  if(!account?.currency)throw Error('Choose an accessible account with a known currency.');
  if((await c.query("SELECT 1 FROM meta_operation_items i JOIN meta_operations o ON o.workspace_id=i.workspace_id AND o.id=i.operation_id WHERE o.connection_id=$1 AND o.account_id=$2 AND i.state IN('running','uncertain') LIMIT 1",[account.connection_id,account.account_id])).rowCount)throw Error('An earlier change is running or uncertain. Reconcile it with Meta before creating another draft for this account.');
  const input=operationInput(form,account.currency);let rows:{id:string|null;name:string;status:string|null;dailyBudget:string|null;lifetimeBudget:string|null}[];
  if(input.kind==='create_campaign')rows=[{id:null,name:input.payload.name!,status:null,dailyBudget:null,lifetimeBudget:null}];
  else{
   const entities=await c.query('SELECT entity_id AS id,name,status,daily_budget AS "dailyBudget",lifetime_budget AS "lifetimeBudget" FROM meta_entities WHERE connection_id=$1 AND account_id=$2 AND level=$3 AND entity_id=ANY($4::text[])',[account.connection_id,account.account_id,input.payload.level,input.ids]);
   if(entities.rowCount!==input.ids.length)throw Error('Every target must be an imported object in this account and entity level.');
   rows=entities.rows;if(rows.some(r=>!['ACTIVE','PAUSED'].includes(r.status??'')))throw Error('Only ACTIVE/PAUSED configured objects are supported.');
   if(input.kind==='daily_budget'&&rows.some(r=>!r.dailyBudget||BigInt(r.dailyBudget)<=0n||BigInt(r.lifetimeBudget??'0')>0n))throw Error('Choose objects with an existing daily budget and no lifetime budget.');
  }
  const operation=(await c.query('INSERT INTO meta_operations(workspace_id,connection_id,account_id,currency,kind,payload,created_by) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id',[session.workspaceId,account.connection_id,account.account_id,account.currency,input.kind,JSON.stringify(input.payload),session.userId])).rows[0].id;
  for(const row of rows)await c.query('INSERT INTO meta_operation_items(workspace_id,operation_id,target_id,snapshot) VALUES($1,$2,$3,$4)',[session.workspaceId,operation,row.id,JSON.stringify({name:row.name,status:row.status,dailyBudget:row.dailyBudget,lifetimeBudget:row.lifetimeBudget})]);
  await c.query("INSERT INTO audit_events(workspace_id,actor_id,action) VALUES($1,$2,'meta.operation_drafted')",[session.workspaceId,session.userId]);return operation as string;
 });
}
export async function approveMetaOperation(session:Session,id:string,confirmation:string,ack:boolean){
 if(!['owner','admin'].includes(session.role)||process.env.META_AD_WRITES_ENABLED!=='true'||!ack)throw Error('Write execution requires owner/admin access, META_AD_WRITES_ENABLED=true and explicit confirmation.');
 await withTenant(session.userId,session.workspaceId,async c=>{
  const row=(await c.query("SELECT o.id,(SELECT count(*) FROM meta_operation_items WHERE operation_id=o.id) AS count FROM meta_operations o JOIN provider_connections p ON p.workspace_id=o.workspace_id AND p.id=o.connection_id WHERE o.id=$1 AND o.status IN('draft','approved') AND o.created_at>now()-interval '15 minutes' AND p.status='connected' AND p.scopes @> ARRAY['ads_management']::text[] AND (p.expires_at IS NULL OR p.expires_at>now()) FOR UPDATE OF o",[id])).rows[0];
  if(!row||confirmation!==`APPLY ${row.count} CHANGES`)throw Error('Review a fresh draft, verify ads_management and type the exact confirmation.');
  await c.query("UPDATE meta_operations SET status='approved',approved_by=$2,approved_at=now() WHERE id=$1",[id,session.userId]);await c.query("INSERT INTO audit_events(workspace_id,actor_id,action) VALUES($1,$2,'meta.operation_approved')",[session.workspaceId,session.userId]);
 });
}
export async function stepMetaOperation(session:Session,id:string){
 if(!['owner','admin'].includes(session.role)||process.env.META_AD_WRITES_ENABLED!=='true')throw Error('Meta write execution is disabled.');
 const claimed=await withTenant(session.userId,session.workspaceId,async c=>{
  await c.query('SELECT pg_advisory_xact_lock(hashtext($1))',['meta-operations:'+session.workspaceId]);
  const operation=(await c.query("SELECT o.*,p.status AS connection_status,p.scopes,p.expires_at,e.envelope,e.key_id FROM meta_operations o JOIN provider_connections p ON p.workspace_id=o.workspace_id AND p.id=o.connection_id JOIN encrypted_credentials e ON e.workspace_id=p.workspace_id AND e.connection_id=p.id WHERE o.id=$1 AND o.status='approved' AND o.approved_at>now()-interval '15 minutes' FOR UPDATE OF o",[id])).rows[0];
  if(!operation)return null;
  if((await c.query("SELECT 1 FROM meta_operation_items i JOIN meta_operations o ON o.workspace_id=i.workspace_id AND o.id=i.operation_id WHERE o.connection_id=$1 AND o.account_id=$2 AND i.state IN('running','uncertain') LIMIT 1",[operation.connection_id,operation.account_id])).rowCount)throw Error('Another change is running or uncertain for this account. Review history before continuing.');
  if(operation.connection_status!=='connected'||!operation.scopes.includes('ads_management')||(operation.expires_at&&operation.expires_at<new Date()))throw Error('Reconnect the Meta account with ads_management.');
  const account=await c.query('SELECT 1 FROM meta_ad_accounts WHERE connection_id=$1 AND account_id=$2 AND accessible',[operation.connection_id,operation.account_id]);if(!account.rowCount)throw Error('Account access changed.');
  if((await c.query("SELECT 1 FROM meta_operation_items WHERE operation_id=$1 AND state='running' LIMIT 1",[id])).rowCount)throw Error('A change is already running. Check history before taking further action.');
  const item=(await c.query("SELECT * FROM meta_operation_items WHERE operation_id=$1 AND state='pending' ORDER BY id LIMIT 1 FOR UPDATE",[id])).rows[0];if(!item)return null;
  await c.query("UPDATE meta_operation_items SET state='running' WHERE id=$1",[item.id]);return {operation,item};
 });
 if(!claimed)return {done:true,state:'no_pending_changes'};
 const {operation,item}=claimed;let state='failed',error:string|null=null,result:string|null=null;
 try{
  if(operation.key_id!==process.env.TOKEN_ENCRYPTION_KEY_ID||!process.env.TOKEN_ENCRYPTION_KEY)throw Error();
  const token=openToken(operation.envelope,`${session.workspaceId}:meta:${operation.connection_id}`,process.env.TOKEN_ENCRYPTION_KEY),config=metaConfig(process.env);
  const identity=await new MetaClient(config,token).validateToken();if(!identity.scopes.includes('ads_management'))throw new MetaWriteError('permission');
  result=await new MetaWriter(config,token).execute(operation.account_id,operation.currency,operation.kind,operation.payload,item.target_id,item.snapshot);state='succeeded';
 }catch(e){error=e instanceof MetaWriteError?e.kind:'preflight_failed';state=error==='uncertain'?'uncertain':'failed';}
 const done=await withTenant(session.userId,session.workspaceId,async c=>{
  await c.query("UPDATE meta_operation_items SET state=$2,result_id=$3,error_code=$4,finished_at=now() WHERE id=$1 AND state='running'",[item.id,state,result,error]);
  if(state!=='succeeded')await c.query("UPDATE meta_operation_items SET state='failed',error_code='not_attempted_after_failure',finished_at=now() WHERE operation_id=$1 AND state='pending'",[id]);
  const remaining=(await c.query("SELECT count(*)::int AS count FROM meta_operation_items WHERE operation_id=$1 AND state IN('pending','running')",[id])).rows[0].count;
  if(!remaining)await c.query("UPDATE meta_operations SET status='finished' WHERE id=$1",[id]);await c.query("INSERT INTO audit_events(workspace_id,actor_id,action) VALUES($1,$2,$3)",[session.workspaceId,session.userId,'meta.operation_item_'+state]);return remaining===0;
 });return {done,state};
}
