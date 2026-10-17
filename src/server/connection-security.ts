import 'server-only';
import {withTenant} from './db';
import type {Session} from './auth';
import {canManageIntegrations} from '@/lib/security';
export type ConnectionSecurity={canManage:boolean;available:boolean;connections:{id:string;provider:string;name:string;status:string;scopes:string[]}[]};
export async function loadConnectionSecurity(session:Session|null):Promise<ConnectionSecurity>{
 const result:ConnectionSecurity={canManage:!!session&&canManageIntegrations(session.role),available:true,connections:[]};if(!session)return result;
 try{result.connections=await withTenant(session.userId,session.workspaceId,async c=>(await c.query("SELECT id,provider,external_id AS name,status,scopes FROM provider_connections WHERE provider IN('meta','shopify') ORDER BY created_at DESC LIMIT 100")).rows);}catch{result.available=false;}return result;
}
