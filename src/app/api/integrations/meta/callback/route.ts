import { NextResponse } from 'next/server';
import { getSession } from '@/server/auth';
import { getMetaConfig,consumeMetaState,saveMetaAuthorization } from '@/server/meta';
import { MetaError } from '@/lib/meta';
export const runtime='nodejs';
export async function GET(request:Request) {
  let origin:string;
  try{origin=new URL(getMetaConfig().redirectUri).origin;}catch{return NextResponse.json({error:'meta_setup_required'},{status:503});}
  const finish=(status:string)=>NextResponse.redirect(`${origin}/integrations?meta=${status}`,{status:303,headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
  try{
    const session=await getSession();if(!session)return finish('session_required');
    const query=new URL(request.url).searchParams;
    const state=query.get('state')??'';
    if(!await consumeMetaState(session,state))return finish('invalid_state');
    if(query.has('error'))return finish('authorization_denied');
    const code=query.get('code');if(!code||code.length>4096)return finish('missing_code');
    const count=await saveMetaAuthorization(session,code);
    return finish(count?'accounts_discovered':'no_accessible_accounts');
  }catch(error){return finish(error instanceof MetaError?error.kind:'connection_failed');}
}
