'use server';
import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {requireSession} from '@/server/auth';
import {withTenant} from '@/server/db';
import {canManageIntegrations} from '@/lib/security';
import {disconnectConnection} from '@/lib/disconnect';
export async function disconnectIntegration(form:FormData){
 const session=await requireSession();let success=false;
 try{if(!canManageIntegrations(session.role)||form.get('confirm')!=='yes')throw new Error('permission_denied');await withTenant(session.userId,session.workspaceId,c=>disconnectConnection(c,String(form.get('connection')??'')));success=true;}catch{}
 revalidatePath('/','layout');redirect('/integrations?connection_notice='+(success?'disconnected':'failed'));
}
