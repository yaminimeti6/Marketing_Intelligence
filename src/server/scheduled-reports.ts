import 'server-only';
import type {Session} from './auth';import {withTenant} from './db';import {ruleAccounts} from '@/lib/rule-data';import type {ReportSchedule} from '@/lib/scheduled-reports';import {emailConfiguration} from '@/lib/email-delivery';
export type ScheduledReportsPage={ready:boolean;canEdit:boolean;emailReady:boolean;accounts:{key:string;name:string;scope:string}[];members:{id:string;name:string}[];schedules:{id:string;definition:ReportSchedule;enabled:boolean;next:string;last:string|null}[];runs:{id:string;name:string;created:string;result:{status:string;from:string;to:string;reason:string;count:number;currency:string;timezone:string};emailStatus:string|null;emailError:string|null;download:boolean}[]};
export async function loadScheduledReports(session:Session|null,selectedRun=''):Promise<ScheduledReportsPage>{
 const empty:ScheduledReportsPage={ready:false,canEdit:!!session&&['owner','admin'].includes(session.role),emailReady:!!emailConfiguration(),accounts:[],members:[],schedules:[],runs:[]};if(!session)return empty;
 try{return await withTenant(session.userId,session.workspaceId,async c=>{
 if(!(await c.query("SELECT to_regclass('public.report_schedules') IS NOT NULL AS ready")).rows[0].ready)return empty;
 const accounts=(await ruleAccounts(c)).map(a=>({key:a.key,name:a.name,scope:`${a.currency}|${a.timezone}`}));
 const members=empty.canEdit?(await c.query("SELECT u.id,u.name FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.workspace_id=$1 ORDER BY u.name LIMIT 501",[session.workspaceId])).rows:[];
 const schedules=(await c.query('SELECT id,definition,enabled,next_run_at,last_run_at FROM report_schedules ORDER BY created_at DESC LIMIT 20')).rows.map(r=>({id:r.id,definition:r.definition,enabled:r.enabled,next:r.next_run_at.toISOString(),last:r.last_run_at?.toISOString()??null}));
 const runs=(await c.query("SELECT r.id,r.report_name AS name,r.created_at,r.result,r.csv IS NOT NULL AS download,e.status AS email_status,e.error_code FROM scheduled_report_runs r LEFT JOIN scheduled_report_emails e ON e.workspace_id=r.workspace_id AND e.run_id=r.id ORDER BY (r.id::text=$1) DESC,r.created_at DESC LIMIT 50",[selectedRun])).rows.map(r=>({id:r.id,name:r.name,created:r.created_at.toISOString(),result:r.result,emailStatus:r.email_status,emailError:r.error_code,download:r.download}));
 return {...empty,ready:true,accounts,members,schedules,runs};
 });}catch{return empty;}
}
