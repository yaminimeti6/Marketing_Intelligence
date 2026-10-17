import { NextResponse } from 'next/server';
import { getSession } from '@/server/auth';
import { getShopifyConfig,beginShopify } from '@/server/shopify';
import { canManageIntegrations } from '@/lib/security';
export const runtime='nodejs';
export async function POST(request:Request){
 const session=await getSession();if(!session)return NextResponse.json({error:'authentication_required'},{status:401});
 if(!canManageIntegrations(session.role))return NextResponse.json({error:'administrator_required'},{status:403});
 try{const origin=new URL(getShopifyConfig().redirectUri).origin;if(request.headers.get('origin')!==origin)return NextResponse.json({error:'origin_mismatch_use_callback_domain'},{status:403});
  const response=await beginShopify(session,request);response.headers.set('Cache-Control','no-store');response.headers.set('Referrer-Policy','no-referrer');return response;
 }catch{return NextResponse.json({error:'shopify_setup_required'},{status:503});}
}
