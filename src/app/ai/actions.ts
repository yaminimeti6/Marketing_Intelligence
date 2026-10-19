'use server';
import {requireSession} from '@/server/auth';
import {withTenant} from '@/server/db';
import {loadMetaReport} from '@/server/meta-report';
import {aiConfiguration,aiInput,aiReportContext,generateAi,type AiState} from '@/lib/ai';

export async function askAi(_previous:AiState,form:FormData):Promise<AiState>{
 const session=await requireSession();
 if(!['owner','admin'].includes(session.role))return {error:'Only owners and admins can use paid AI requests.'};
 let input:ReturnType<typeof aiInput>;
 try{input=aiInput(form);aiConfiguration(process.env);}catch(e){return {error:(e as Error).message};}
 let context:unknown;
 if(input.mode==='copilot')context=aiReportContext(await loadMetaReport(session,{}));
 try{
 const allowed=await withTenant(session.userId,session.workspaceId,async c=>{
   await c.query('SELECT pg_advisory_xact_lock(hashtext($1))',['ai:'+session.workspaceId]);
   const count=await c.query("SELECT count(*)::int AS count FROM audit_events WHERE action='ai.requested' AND created_at>now()-interval '1 hour'");
   if(count.rows[0].count>=10)return false;
   await c.query("INSERT INTO audit_events(workspace_id,actor_id,action) VALUES($1,$2,'ai.requested')",[session.workspaceId,session.userId]);return true;
 });
 if(!allowed)return {error:'Workspace AI limit reached: 10 attempts per rolling hour, including failed attempts. Try later.'};
 }catch{return {error:'AI request could not be authorized. No provider request was sent.'};}
 try{return {text:await generateAi(input,context,process.env)};}catch(e){return {error:(e as Error).message};}
}
