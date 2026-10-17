import 'server-only';
import type { Session } from './auth';
import {withTenant} from './db';
export type ReportLibrary={ready:boolean;presets:{id:string;name:string;filters:Record<string,string>}[];exports:{id:string;count:number;complete:boolean;created:string}[]};
export async function reportLibrary(session:Session|null):Promise<ReportLibrary>{
 const empty:ReportLibrary={ready:false,presets:[],exports:[]};if(!session)return empty;
 try{return await withTenant(session.userId,session.workspaceId,async c=>{
  const ready=(await c.query("SELECT to_regclass('public.report_presets') IS NOT NULL AND to_regclass('public.report_exports') IS NOT NULL AS ready")).rows[0].ready;if(!ready)return empty;
  const presets=(await c.query('SELECT id,name,filters FROM report_presets ORDER BY updated_at DESC LIMIT 50')).rows;
  const exports=(await c.query('SELECT id,row_count AS count,complete,created_at FROM report_exports ORDER BY created_at DESC LIMIT 10')).rows.map(r=>({id:r.id,count:r.count,complete:r.complete,created:r.created_at.toISOString()}));
  return {ready:true,presets,exports};
 });}catch{return empty;}
}
