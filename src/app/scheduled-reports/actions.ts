'use server';
import {requireSession} from '@/server/auth';import {withTenant} from '@/server/db';import {saveSchedule,toggleSchedule,runSchedule} from '@/lib/scheduled-report-store';import {revalidatePath} from 'next/cache';
export async function scheduledReportAction(_previous:{message:string},form:FormData){
 const s=await requireSession();if(!['owner','admin'].includes(s.role))return {message:'Owner or admin access required.'};
 try{const op=String(form.get('operation')??'create');const result=await withTenant(s.userId,s.workspaceId,async c=>{
 if(op==='create'){const recipient=String(form.get('recipient')??'');if(recipient&&form.get('emailConsent')!=='yes')throw Error();await saveSchedule(c,{name:String(form.get('name')??''),scope:String(form.get('scope')??''),account:String(form.get('account')??'all'),frequency:String(form.get('frequency')??''),hour:Number(form.get('hour')),days:Number(form.get('days')),recipient},form.get('enabled')==='yes');return 'Schedule saved. Automatic generation and email notifications require an active reports worker.';}
 const id=String(form.get('id')??'');if(op==='pause'||op==='enable'){await toggleSchedule(c,id,op==='enable');return op==='pause'?'Schedule paused; pending email notifications skipped.':'Schedule enabled. Next run is shown in UTC.';}
 if(op==='run'){const status=await runSchedule(c,id,false);return status==='ready'?'Snapshot saved. Enabled schedules with a recipient queue an email notification for the reports worker.':'Run recorded as unavailable. Check coverage and freshness; no email queued.';}throw Error();
 },true);revalidatePath('/scheduled-reports');return {message:result};
 }catch{return {message:'Could not complete. Check source access, fields, email consent and the 20-schedule limit. Generate now is limited to once per schedule per minute.'};}
}
