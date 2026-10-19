import 'server-only';
import {withTenant} from './db';
import type {Session} from './auth';
export async function reserveAiAttempt(session:Session,image=false){
 return withTenant(session.userId,session.workspaceId,async c=>{
  await c.query('SELECT pg_advisory_xact_lock(hashtext($1))',['ai:'+session.workspaceId]);
  const counts=await c.query("SELECT count(*)::int AS total,count(*) FILTER(WHERE action='ai.image_requested')::int AS images FROM audit_events WHERE action IN('ai.requested','ai.image_requested') AND created_at>now()-interval '1 hour'");
  if(counts.rows[0].total>=10||(image&&counts.rows[0].images>=2))return false;
  await c.query('INSERT INTO audit_events(workspace_id,actor_id,action) VALUES($1,$2,$3)',[session.workspaceId,session.userId,image?'ai.image_requested':'ai.requested']);return true;
 });
}
