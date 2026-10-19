import type {PoolClient} from 'pg';
import {scheduleInput,scheduleSlot,scheduledSnapshot} from './scheduled-reports.ts';
import {ruleAccounts,ruleAnalytics} from './rule-data.ts';
const uuid=(s:string)=>/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(s);
async function manager(c:PoolClient){const r=await c.query("SELECT workspace_id,user_id FROM memberships WHERE workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid AND user_id=nullif(current_setting('app.user_id',true),'')::uuid AND role IN('owner','admin')");if(!r.rowCount)throw Error('schedule_permission');return r.rows[0];}
export async function saveSchedule(c:PoolClient,input:unknown,enabled:boolean,now=new Date()){
 const actor=await manager(c),s=scheduleInput(input);const accounts=await ruleAccounts(c);if(!accounts.some(a=>`${a.currency}|${a.timezone}`===s.scope&&(s.account==='all'||a.key===s.account)))throw Error('schedule_account');
 await c.query('SELECT pg_advisory_xact_lock(hashtext($1),hashtext($2))',[actor.workspace_id,'report_schedules']);
 if(Number((await c.query('SELECT count(*) FROM report_schedules')).rows[0].count)>=20)throw Error('schedule_limit');
 if(s.recipient&&!(await c.query('SELECT user_id FROM memberships WHERE workspace_id=$1 AND user_id=$2',[actor.workspace_id,s.recipient])).rowCount)throw Error('schedule_recipient');
 const r=await c.query('INSERT INTO report_schedules(workspace_id,created_by,definition,enabled,next_run_at) VALUES($1,$2,$3,$4,$5) RETURNING id',[actor.workspace_id,actor.user_id,JSON.stringify(s),enabled,scheduleSlot(s,now,true)]);
 await c.query("INSERT INTO audit_events(workspace_id,actor_id,action) VALUES($1,$2,'report.schedule_created')",[actor.workspace_id,actor.user_id]);return r.rows[0].id as string;
}
export async function toggleSchedule(c:PoolClient,id:string,enabled:boolean,now=new Date()){
 const actor=await manager(c);if(!uuid(id))throw Error('schedule_id');const r=await c.query('SELECT definition FROM report_schedules WHERE id=$1 FOR UPDATE',[id]);if(!r.rowCount)throw Error('schedule_access');const s=scheduleInput(r.rows[0].definition);
 await c.query('UPDATE report_schedules SET enabled=$1,next_run_at=$2,updated_at=now() WHERE id=$3',[enabled,scheduleSlot(s,now,true),id]);
 if(!enabled)await c.query("UPDATE scheduled_report_emails SET status='skipped',error_code='schedule_paused',finished_at=now() WHERE status='pending' AND run_id IN(SELECT id FROM scheduled_report_runs WHERE schedule_id=$1)",[id]);
 await c.query("INSERT INTO audit_events(workspace_id,actor_id,action) VALUES($1,$2,$3)",[actor.workspace_id,actor.user_id,enabled?'report.schedule_enabled':'report.schedule_paused']);
}
export async function runSchedule(c:PoolClient,id:string,automatic=true,now=new Date()){
 const actor=await manager(c);if(!uuid(id))throw Error('schedule_id');const row=(await c.query('SELECT * FROM report_schedules WHERE id=$1 FOR UPDATE',[id])).rows[0];if(!row)throw Error('schedule_access');
 if(automatic&&(!row.enabled||row.next_run_at>now))return 'skipped';
 if(!automatic){const r=await c.query("SELECT count(*)::int AS count FROM scheduled_report_runs WHERE schedule_id=$1 AND created_at>now()-interval '1 minute'",[id]);if(r.rows[0].count)throw Error('schedule_rate_limit');}
 const s=scheduleInput(row.definition),slot=automatic?'scheduled:'+scheduleSlot(s,now).toISOString():'manual:'+now.toISOString();
 if((await c.query('SELECT id FROM scheduled_report_runs WHERE schedule_id=$1 AND slot=$2',[id,slot])).rowCount)return 'skipped';
 const data=await ruleAnalytics(c,{scope:s.scope,account:s.account,provider:'meta',days:s.days},now),snapshot=scheduledSnapshot(s,data,now);const {csv,...result}=snapshot;
 const saved=await c.query('INSERT INTO scheduled_report_runs(workspace_id,schedule_id,slot,report_name,definition,result,csv) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id',[actor.workspace_id,id,slot,s.name,JSON.stringify(s),JSON.stringify(result),csv]);
 if(s.recipient&&row.enabled&&snapshot.status==='ready')await c.query('INSERT INTO scheduled_report_emails(workspace_id,run_id,recipient_id) VALUES($1,$2,$3)',[actor.workspace_id,saved.rows[0].id,s.recipient]);
 // Generation and advancing the schedule commit together: a crash cannot leave a half-published report.
 await c.query('UPDATE report_schedules SET last_run_at=$1,next_run_at=CASE WHEN $2 THEN $3 ELSE next_run_at END WHERE id=$4',[now,automatic,scheduleSlot(s,now,true),id]);
 await c.query('DELETE FROM scheduled_report_runs WHERE schedule_id=$1 AND id IN(SELECT id FROM scheduled_report_runs WHERE schedule_id=$1 ORDER BY created_at DESC,id DESC OFFSET 30)',[id]);
 await c.query("INSERT INTO audit_events(workspace_id,actor_id,action) VALUES($1,$2,'report.scheduled_snapshot_generated')",[actor.workspace_id,actor.user_id]);return snapshot.status;
}
