import { NextResponse } from 'next/server';
import { getSession } from '@/server/auth';
import { getShopifyConfig,consumeShopifyState,saveShopifyAuthorization } from '@/server/shopify';
import { ShopifyError,shopifySdk } from '@/lib/shopify';
export const runtime='nodejs';
export async function GET(request:Request){
 let config;try{config=getShopifyConfig();}catch{return NextResponse.json({error:'shopify_setup_required'},{status:503});}
 const finish=(status:string)=>NextResponse.redirect(`${new URL(config.redirectUri).origin}/integrations?shopify=${status}`,{status:303,headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
 try{
  const session=await getSession();if(!session)return finish('session_required');
  const query=new URL(request.url).searchParams;
  if([...query.keys()].some(k=>query.getAll(k).length!==1)||query.get('shop')!==config.shop)return finish('invalid_state');
  if(!await consumeShopifyState(session,query.get('state')??'',config.shop))return finish('invalid_state');
  if(query.has('error'))return finish('authorization_denied');
  const code=query.get('code');if(!code||code.length>4096)return finish('invalid_state');
  const callback=await shopifySdk(config).auth.callback<Headers>({rawRequest:request,expiring:true});
  await saveShopifyAuthorization(session,callback.session);
  const response=finish('authorized');const cookieHeaders=callback.headers;
  if(cookieHeaders instanceof Headers)for(const value of cookieHeaders.getSetCookie())response.headers.append('Set-Cookie',value);
  return response;
 }catch(error){return finish(error instanceof ShopifyError?error.kind:'connection_failed');}
}
