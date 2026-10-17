import {createHash,createHmac,timingSafeEqual} from 'node:crypto';
import {shopifyDomain} from './shopify-config.ts';
export const webhookTopics=['orders/create','orders/updated','orders/cancelled','refunds/create','products/create','products/update','products/delete','app/uninstalled'] as const;
export function verifyShopifyWebhook(body:Uint8Array,signature:string,secret:string){
 if(!secret||body.byteLength>1048576||!/^[A-Za-z0-9+/]{43}=$/.test(signature))return false;
 const actual=Buffer.from(signature,'base64'),expected=createHmac('sha256',secret).update(body).digest();return actual.length===expected.length&&timingSafeEqual(actual,expected);
}
export function webhookEnvelope(body:Uint8Array,shop:string,topic:string,eventId:string){
 const domain=shopifyDomain(shop);if(!(webhookTopics as readonly string[]).includes(topic)||! /^[a-zA-Z0-9-]{16,128}$/.test(eventId))throw new Error('invalid_webhook');
 const data=JSON.parse(Buffer.from(body).toString('utf8'));if(!data||typeof data!=='object'||Array.isArray(data))throw new Error('invalid_webhook');
 // Destructive lifecycle handling requires the signed body itself to name the shop.
 if(topic==='app/uninstalled'&&data.myshopify_domain!==domain)throw new Error('invalid_webhook');
 return {domain,topic,eventId,bodyHash:createHash('sha256').update(body).digest('hex')};
}
