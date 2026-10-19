import {readFileSync,existsSync} from 'node:fs';import {parseEnv} from 'node:util';import pg from 'pg';
import {tenantTransaction} from '../src/lib/tenant-db.ts';
import {runSchedule} from '../src/lib/scheduled-report-store.ts';
import {claimReportEmail} from '../src/lib/scheduled-report-outbox.ts';
import {sendScheduledReport} from '../src/lib/scheduled-report-email.ts';
const file=new URL('../.env',import.meta.url),env={...(existsSync(file)?parseEnv(readFileSync(file,'utf8')):{}),...process.env};
const user=env.REPORTS_WORKER_USER_ID||env.META_WORKER_USER_ID||env.SHOPIFY_WORKER_USER_ID;let pool:pg.Pool|undefined;
try{
 if(!user||!/^[a-f0-9-]{36}$/i.test(user)||!env.DATABASE_URL)throw Error('setup');pool=new pg.Pool({connectionString:env.DATABASE_URL,max:2,connectionTimeoutMillis:5000});
 const memberships=await pool.query("SELECT workspace_id FROM memberships WHERE user_id=$1 AND role IN('owner','admin')",[user]);let generated=0,accepted=0;
 for(const {workspace_id:workspace} of memberships.rows){
  const ids=await tenantTransaction(pool,user,workspace,async c=>{if(!(await c.query("SELECT to_regclass('public.report_schedules') IS NOT NULL AS ready")).rows[0].ready)return [];return (await c.query('SELECT id FROM report_schedules WHERE enabled AND next_run_at<=now() ORDER BY next_run_at LIMIT 20')).rows.map(r=>r.id as string);});
  for(const id of ids)try{const outcome=await tenantTransaction(pool,user,workspace,c=>runSchedule(c,id),true);if(outcome!=='skipped')generated++;}catch{console.error('A scheduled report could not complete; the next worker pass will retry.');}
  for(let i=0;i<20;i++){
   const input=await tenantTransaction(pool,user,workspace,async c=>{if(!(await c.query("SELECT to_regclass('public.scheduled_report_emails') IS NOT NULL AS ready")).rows[0].ready)return null;return claimReportEmail(c);});if(!input)break;
   // The sending claim commits before the external POST. Unknown outcomes are never automatically retried.
   const result=await sendScheduledReport(input,env);await tenantTransaction(pool,user,workspace,async c=>{await c.query("UPDATE scheduled_report_emails SET status=$1,error_code=$2,provider_id=$3,finished_at=now() WHERE run_id=$4 AND status='sending'",[result.status,result.code,result.providerId??null,input.run]);});if(result.status==='accepted')accepted++;
  }
 }
 if(generated||accepted||env.REPORTS_WORKER_VERBOSE==='true')console.log(`Scheduled reports pass: ${generated} snapshots recorded; ${accepted} email notifications accepted by provider (inbox delivery unconfirmed).`);
}catch{console.error('Scheduled reports worker unavailable. Check database, migrations and Owner/Admin worker identity.');process.exitCode=1;}
finally{await pool?.end();}
