import { NextResponse } from 'next/server';
import { getSession } from '@/server/auth';
import { getMetaConfig,createMetaState } from '@/server/meta';
import { oauthUrl } from '@/lib/meta';
import { canManageIntegrations } from '@/lib/security';
export const runtime='nodejs';
export async function POST(request:Request) {
  const session=await getSession();
  if(!session)return NextResponse.json({error:'authentication_required'},{status:401});
  if(!canManageIntegrations(session.role))return NextResponse.json({error:'administrator_required'},{status:403});
  try{
    const config=getMetaConfig();
    const origin=new URL(config.redirectUri).origin;
    if(request.headers.get('origin')!==origin)return NextResponse.json({error:'origin_mismatch_use_callback_domain'},{status:403});
    const form=await request.formData().catch(()=>new FormData());
    const state=await createMetaState(session);
    return NextResponse.redirect(oauthUrl(config,state,form.get('management')==='yes'),{status:303,headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
  }catch{return NextResponse.json({error:'meta_setup_required'},{status:503});}
}
