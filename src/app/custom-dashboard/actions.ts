'use server';
import {requireSession} from '@/server/auth';import {withTenant} from '@/server/db';import {saveCustomDashboard} from '@/lib/custom-dashboard-store';import {revalidatePath} from 'next/cache';
export async function saveDashboardAction(_previous:{message:string;id:string},form:FormData){
 const session=await requireSession();if(!['owner','admin'].includes(session.role))return {message:'Owner or admin access required.',id:''};
 try{const raw=String(form.get('definition')??'');if(raw.length>6000)throw Error();const id=await withTenant(session.userId,session.workspaceId,c=>saveCustomDashboard(c,JSON.parse(raw),form.get('mode')==='new'?'':String(form.get('id')??''),Number(form.get('revision'))));revalidatePath('/custom-dashboard');return {message:'Dashboard saved.',id};}
 catch(e){return {message:e instanceof Error&&e.message==='dashboard_conflict'?'Another editor changed this dashboard. Reload before saving.':'Could not save. Check source access, widget settings and the 10-dashboard limit.',id:''};}
}
