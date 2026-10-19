'use server';
import {redirect} from 'next/navigation';
import {requireSession} from '@/server/auth';
import {withTenant} from '@/server/db';
import {experimentInput} from '@/lib/experiments';
export async function saveExperiment(form:FormData){
 const session=await requireSession();let notice='failed';
 if(['owner','admin'].includes(session.role))try{await withTenant(session.userId,session.workspaceId,async c=>{
  const operation=String(form.get('operation')??'create');
  if(operation==='create'){
   const x=experimentInput(form),source=String(form.get('source')??'');const allowed=await c.query('SELECT id FROM shopify_pixel_sources WHERE id=$1 AND enabled AND measurement_enabled',[source]);if(!allowed.rowCount)throw Error();
   const count=await c.query('SELECT count(*)::int AS count FROM storefront_experiments');if(count.rows[0].count>=30)throw Error();
   await c.query('INSERT INTO storefront_experiments(workspace_id,source_id,name,kind,entry_path,variant_a,variant_b) VALUES($1,$2,$3,$4,$5,$6,$7)',[session.workspaceId,source,x.name,x.kind,x.entry,x.a,x.b]);
  }else if(operation==='start'){
   const changed=await c.query("UPDATE storefront_experiments SET status='running',started_at=now(),ends_at=now()+interval '14 days' WHERE id=$1 AND status='draft' AND (SELECT browser_event_retention_days FROM workspaces WHERE id=$2)>=30",[String(form.get('id')),session.workspaceId]);if(!changed.rowCount)throw Error();
  }else if(operation==='stop'){await c.query("UPDATE storefront_experiments SET status='stopped' WHERE id=$1 AND status='running'",[String(form.get('id'))]);}else throw Error();
  await c.query("INSERT INTO audit_events(workspace_id,actor_id,action) VALUES($1,$2,'experiment.configuration_changed')",[session.workspaceId,session.userId]);
 });notice='saved';}catch{}
 redirect('/experiments?notice='+notice);
}
