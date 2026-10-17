'use server';
import { redirect } from 'next/navigation';
import { requireSession } from '@/server/auth';
import { queueMetaSync } from '@/server/meta';
export async function requestMetaSync(form:FormData) {
  const session=await requireSession();
  let ok=false;
  let hasSelection=false;
  try{
    const selected=form.getAll('account').map(String);
    hasSelection=selected.length>0;
    if(selected.length>500)throw new Error();
    await queueMetaSync(session,selected);ok=true;
  }catch{}
  redirect(ok?hasSelection?'/integrations?meta=sync_queued':'/integrations?meta=selection_saved':'/integrations?meta=sync_request_failed');
}
