'use server';
import {redirect} from 'next/navigation';
import {requireSession} from '@/server/auth';
import {withTenant} from '@/server/db';
import {loadMetaReport} from '@/server/meta-report';
import {metaQueryValues} from '@/lib/meta-report';
import {loadAnalytics} from '@/server/analytics';
import {analyticsView,analyticsValues} from '@/lib/analytics';
export async function saveAnalyticsPreset(form:FormData){
 const session=await requireSession();let destination='/analytics?report_notice=save_failed';
 try{const name=String(form.get('name')??'').trim();if(!name||name.length>80||/[\x00-\x1f]/.test(name))throw new Error();
  const raw=Object.fromEntries(['start','end','provider','account','scope','status','q','compare','columns','sort','direction','group','dimension'].map(k=>[k,String(form.get(k)??'')]));
  const data=await loadAnalytics(session,raw),v=analyticsView(data,raw);if(v.error||data.errors.length||!v.accounts.length)throw new Error();const filters={...analyticsValues(v.q),report:'analytics'};
  await withTenant(session.userId,session.workspaceId,async c=>{await c.query('SELECT pg_advisory_xact_lock(hashtext($1),hashtext($2))',[session.workspaceId,session.userId]);const count=Number((await c.query('SELECT count(*) FROM report_presets')).rows[0].count),existing=await c.query('SELECT id FROM report_presets WHERE name=$1',[name]);if(count>=50&&!existing.rowCount)throw new Error();await c.query('INSERT INTO report_presets(workspace_id,user_id,name,filters) VALUES($1,$2,$3,$4) ON CONFLICT(workspace_id,user_id,name) DO UPDATE SET filters=$4,updated_at=now()',[session.workspaceId,session.userId,name,JSON.stringify(filters)]);});destination='/analytics?'+new URLSearchParams({...filters,report_notice:'saved'});
 }catch{}redirect(destination);
}
export async function saveMetaPreset(form:FormData){
 const session=await requireSession();let destination='/reports?report_notice=save_failed';
 try{
  const name=String(form.get('name')??'').trim();if(!name||name.length>80||/[\x00-\x1f]/.test(name))throw new Error();
  const params=Object.fromEntries(['start','end','account','scope','compare','level','parent','status','q'].map(k=>[k,String(form.get(k)??'')]));
  const report=await loadMetaReport(session,params);if(report.error||report.query.error)throw new Error();
  const filters=metaQueryValues(report.query);
  await withTenant(session.userId,session.workspaceId,async c=>{
   await c.query('SELECT pg_advisory_xact_lock(hashtext($1),hashtext($2))',[session.workspaceId,session.userId]);
   const count=await c.query('SELECT count(*)::int AS count FROM report_presets');
   const existing=await c.query('SELECT id FROM report_presets WHERE name=$1',[name]);
   if(count.rows[0].count>=50&&!existing.rowCount)throw new Error();
   await c.query(`INSERT INTO report_presets(workspace_id,user_id,name,filters) VALUES($1,$2,$3,$4) ON CONFLICT(workspace_id,user_id,name) DO UPDATE SET filters=$4,updated_at=now()`,[session.workspaceId,session.userId,name,JSON.stringify(filters)]);
  });destination='/reports?'+new URLSearchParams({...filters,report_notice:'saved'});
 }catch{}redirect(destination);
}
export async function deleteMetaPreset(form:FormData){
 const session=await requireSession();let notice='delete_failed';
 try{const id=String(form.get('preset')??'');if(!/^[a-f0-9-]{36}$/i.test(id))throw new Error();await withTenant(session.userId,session.workspaceId,async c=>{const r=await c.query('DELETE FROM report_presets WHERE id=$1 RETURNING id',[id]);if(!r.rowCount)throw new Error();});notice='deleted';}catch{}
 redirect('/reports?report_notice='+notice);
}
