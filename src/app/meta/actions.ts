'use server';
import { redirect } from 'next/navigation';
import { randomUUID } from 'node:crypto';
import { requireSession } from '@/server/auth';
import { withTenant } from '@/server/db';
import { canManageIntegrations } from '@/lib/security';
import { reportQuery,shiftDay,accountScope,type ReportAccount } from '@/lib/meta-report';

export async function syncReportRange(form:FormData){
  const session=await requireSession();
  const start=String(form.get('start')??''),end=String(form.get('end')??'');
  const account=String(form.get('account')??'all'),scope=String(form.get('scope')??'');
  const compare=form.get('compare')==='true';
  const query=reportQuery({start,end,account,scope,compare:String(compare)},shiftDay(new Date().toISOString().slice(0,10),1));
  const target=String(form.get('destination')??'');
  const destination=target==='campaigns'?'/campaigns':target==='reports'?'/reports':'/meta';
  let notice='sync_failed';
  try{
    if(!canManageIntegrations(session.role)||query.error||query.start!==start||query.end!==end)throw new Error();
    await withTenant(session.userId,session.workspaceId,async c=>{
      const result=await c.query(`SELECT a.connection_id,a.account_id,a.currency,a.timezone_name FROM meta_ad_accounts a JOIN provider_connections p ON p.workspace_id=a.workspace_id AND p.id=a.connection_id
        WHERE a.accessible AND p.provider='meta' AND p.status='connected' AND (p.expires_at IS NULL OR p.expires_at>now()) ORDER BY a.discovered_at DESC`);
      const seen=new Set<string>();
      const eligible=result.rows.filter(r=>{if(seen.has(r.account_id))return false;seen.add(r.account_id);return true;});
      const selected=eligible.filter(r=>(account==='all'||`${r.connection_id}:${r.account_id}`===account)&&accountScope({currency:r.currency,timezone:r.timezone_name} as ReportAccount)===scope);
      if(!selected.length)throw new Error();
      for(const a of selected){
        await c.query('UPDATE meta_ad_accounts SET selected=true WHERE connection_id=$1 AND account_id=$2',[a.connection_id,a.account_id]);
        const periods=[{since:start,until:end},...(compare?[{since:query.priorStart,until:query.priorEnd}]:[])];
        for(const period of periods)await c.query(`INSERT INTO sync_jobs(workspace_id,connection_id,provider,dedupe_key,payload)
          SELECT $1,$2,'meta',$3,$4 WHERE NOT EXISTS(SELECT 1 FROM sync_jobs WHERE connection_id=$2 AND status IN('queued','running') AND payload->>'accountId'=$5 AND payload->>'since'=$6 AND payload->>'until'=$7)`,[session.workspaceId,a.connection_id,randomUUID(),JSON.stringify({accountId:a.account_id,...period}),a.account_id,period.since,period.until]);
      }
      await c.query("INSERT INTO audit_events(workspace_id,actor_id,action) VALUES($1,$2,'meta.report_sync_requested')",[session.workspaceId,session.userId]);
    });notice='sync_queued';
  }catch{}
  const params=new URLSearchParams({start,end,account,scope,compare:String(compare),notice});
  redirect(`${destination}?${params}`);
}
