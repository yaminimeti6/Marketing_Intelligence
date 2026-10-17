import {NextResponse} from 'next/server';
import {randomUUID} from 'node:crypto';
import {db,withTenant} from '@/server/db';
import {getShopifyConfig} from '@/server/shopify';
import {verifyShopifyWebhook,webhookEnvelope} from '@/lib/shopify-webhooks';
import {disconnectConnection} from '@/lib/disconnect';
export const runtime='nodejs';
export async function POST(request:Request){
 let config;try{config=getShopifyConfig();}catch{return NextResponse.json({error:'setup_required'},{status:503});}
 const reader=request.body?.getReader();if(!reader)return new Response(null,{status:400});const chunks:Uint8Array[]=[];let size=0;
 try{while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>1048576){await reader.cancel();return new Response(null,{status:413});}chunks.push(part.value);}}catch{return new Response(null,{status:400});}
 const body=Buffer.concat(chunks);if(!verifyShopifyWebhook(body,request.headers.get('x-shopify-hmac-sha256')??'',config.clientSecret))return new Response(null,{status:401});
 let envelope;try{envelope=webhookEnvelope(body,request.headers.get('x-shopify-shop-domain')??'',request.headers.get('x-shopify-topic')??'',request.headers.get('x-shopify-event-id')??request.headers.get('x-shopify-webhook-id')??'');if(envelope.domain!==config.shop)throw new Error();}catch{return new Response(null,{status:400});}
 const worker=process.env.SHOPIFY_WORKER_USER_ID;if(!worker||!/^[a-f0-9-]{36}$/i.test(worker))return new Response(null,{status:503});
 try{
  const memberships=await db().query("SELECT workspace_id FROM memberships WHERE user_id=$1 AND role IN('owner','admin')",[worker]);
  for(const {workspace_id:workspace} of memberships.rows)await withTenant(worker,workspace,async c=>{
   const store=(await c.query("SELECT s.connection_id,s.discovered_at,p.status FROM shopify_stores s JOIN provider_connections p ON p.workspace_id=s.workspace_id AND p.id=s.connection_id WHERE s.shop_domain=$1 AND p.provider='shopify' AND p.status='connected' FOR UPDATE OF p",[envelope.domain])).rows[0];if(!store)return;
   const receipt=await c.query('INSERT INTO shopify_webhook_receipts(workspace_id,connection_id,topic,event_id,body_hash) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING RETURNING event_id',[workspace,store.connection_id,envelope.topic,envelope.eventId,envelope.bodyHash]);if(!receipt.rowCount)return;
   if(envelope.topic==='app/uninstalled'){
    const triggered=Date.parse(request.headers.get('x-shopify-triggered-at')??'');
    if(Number.isFinite(triggered)&&triggered>=store.discovered_at.getTime())await disconnectConnection(c,store.connection_id);
    return;
   }
   const active=await c.query("SELECT 1 FROM sync_jobs WHERE connection_id=$1 AND provider='shopify' AND status IN('queued','running')",[store.connection_id]);
   if(!active.rowCount){const until=new Date().toISOString(),since=new Date(Date.now()-59*86400000).toISOString();await c.query("INSERT INTO sync_jobs(workspace_id,connection_id,provider,dedupe_key,payload) VALUES($1,$2,'shopify',$3,$4)",[workspace,store.connection_id,'webhook:'+randomUUID(),JSON.stringify({since,until})]);}
   await c.query("DELETE FROM shopify_webhook_receipts WHERE received_at<now()-interval '90 days'");
  });
  return new Response(null,{status:200});
 }catch{return new Response(null,{status:503,headers:{'Retry-After':'10'}});}
}
