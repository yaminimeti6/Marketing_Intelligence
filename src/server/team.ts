import 'server-only';
import {emailConfiguration} from '@/lib/email-delivery';
import {cookies} from 'next/headers';
import {withTenant,db} from './db';
import {sessionCookie,type Session} from './auth';
import {hashToken} from '@/lib/security';
export type TeamSettings={ready:boolean;emailReady:boolean;retentionDays:number;referenceTime:number;currencies:string[];timezones:string[];auditEvents:{id:string;action:string;created:string}[];auditAvailable:boolean;role:'owner'|'admin'|'analyst'|'viewer';workspace:{id:string;name:string;currency:string|null;timezone:string|null};profile:{id:string;name:string;email:string};workspaces:{id:string;name:string;role:string}[];members:{id:string;name:string;email:string;role:'owner'|'admin'|'analyst'|'viewer'}[];invitations:{id:string;email:string;role:'admin'|'analyst'|'viewer';created_by:string;created_at:string;expires_at:string;revoked_at:string|null;accepted_at:string|null}[];events:{action:string;created_at:string;details:Record<string,unknown>}[]};
export async function teamCommand(session:Session,action:string,data:Record<string,unknown>={}){
 const token=(await cookies()).get(sessionCookie)?.value;if(!token)throw new Error('team_permission');
 return withTenant(session.userId,session.workspaceId,async c=>{
  await c.query("SELECT set_config('app.session_hash',$1,true)",[hashToken(token)]);
  return (await c.query('SELECT team_manage($1,$2) AS result',[action,JSON.stringify(data)])).rows[0].result;
 });
}
export async function loadTeamSettings(session:Session|null):Promise<TeamSettings|null>{
 if(!session)return null;try{const result=await teamCommand(session,'read') as TeamSettings;let auditEvents:TeamSettings['auditEvents']=[],auditAvailable=true;
  if(result.role==='owner'||result.role==='admin')try{auditEvents=await withTenant(session.userId,session.workspaceId,async c=>(await c.query('SELECT id,action,created_at FROM audit_events ORDER BY created_at DESC LIMIT 100')).rows.map(r=>({id:r.id,action:r.action,created:r.created_at.toISOString()})));}catch{auditAvailable=false;}
  const retention=(await db().query('SELECT browser_event_retention_days FROM workspaces WHERE id=$1',[session.workspaceId])).rows[0];
  return {...result,emailReady:!!emailConfiguration(),retentionDays:retention.browser_event_retention_days,auditEvents,auditAvailable,referenceTime:Date.now(),currencies:Intl.supportedValuesOf('currency'),timezones:[...new Set(['UTC','Asia/Kolkata',...Intl.supportedValuesOf('timeZone'),...(result.workspace.timezone?[result.workspace.timezone]:[])])].sort()};}catch{return null;}
}
export async function passwordAttempt(identity:string){
 const result=await db().query(`INSERT INTO login_attempts(identity_hash,attempts) VALUES($1,1) ON CONFLICT(identity_hash) DO UPDATE SET attempts=CASE WHEN login_attempts.window_start<now()-interval '15 minutes' THEN 1 ELSE login_attempts.attempts+1 END,window_start=CASE WHEN login_attempts.window_start<now()-interval '15 minutes' THEN now() ELSE login_attempts.window_start END RETURNING attempts`,[hashToken(identity)]);
 if(result.rows[0].attempts>10)throw new Error('team_attempt_limit');
}
