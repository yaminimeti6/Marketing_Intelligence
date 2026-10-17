'use server';
import { redirect } from 'next/navigation';
import { requireSession } from '@/server/auth';
import { queueShopifySync } from '@/server/shopify';
export async function requestShopifySync(form:FormData){
 const session=await requireSession();let notice='sync_failed';
 try{await queueShopifySync(session,String(form.get('connection')??''));notice='sync_queued';}catch{}
 redirect(`${form.get('returnTo')==='shopify'?'/shopify':'/integrations'}?shopify=${notice}`);
}
