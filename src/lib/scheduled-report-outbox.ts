import type {PoolClient} from 'pg';
export async function claimReportEmail(c:PoolClient){
 await c.query("UPDATE scheduled_report_emails SET status='skipped',error_code='notification_expired',finished_at=now() WHERE status='pending' AND run_id IN(SELECT id FROM scheduled_report_runs WHERE created_at<now()-interval '1 day')");
 const row=(await c.query("SELECT e.run_id,e.recipient_id,r.report_name,r.result FROM scheduled_report_emails e JOIN scheduled_report_runs r ON r.workspace_id=e.workspace_id AND r.id=e.run_id JOIN report_schedules s ON s.workspace_id=r.workspace_id AND s.id=r.schedule_id WHERE e.status='pending' AND s.enabled ORDER BY r.created_at LIMIT 1 FOR UPDATE OF e SKIP LOCKED")).rows[0];if(!row)return null;
 const member=(await c.query("SELECT u.email FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid AND m.user_id=$1",[row.recipient_id])).rows[0];
 if(!member){await c.query("UPDATE scheduled_report_emails SET status='skipped',error_code='recipient_removed',finished_at=now() WHERE run_id=$1",[row.run_id]);return null;}
 await c.query("UPDATE scheduled_report_emails SET status='sending',claimed_at=now() WHERE run_id=$1",[row.run_id]);return {run:row.run_id,email:member.email,name:row.report_name,from:row.result.from,to:row.result.to};
}
