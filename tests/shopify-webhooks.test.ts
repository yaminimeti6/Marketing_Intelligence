import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {verifyShopifyWebhook,webhookEnvelope} from '../src/lib/shopify-webhooks.ts';
test('Shopify webhooks verify exact raw bytes and reject malformed signatures, altered payloads and oversized requests',()=>{
 const raw=Buffer.from('{"id":123}'),secret='test-secret',signature=createHmac('sha256',secret).update(raw).digest('base64');
 assert.equal(verifyShopifyWebhook(raw,signature,secret),true);assert.equal(verifyShopifyWebhook(Buffer.from('{"id":124}'),signature,secret),false);assert.equal(verifyShopifyWebhook(raw,'bad',secret),false);assert.equal(verifyShopifyWebhook(raw,signature,'wrong'),false);assert.equal(verifyShopifyWebhook(new Uint8Array(1048577),signature,secret),false);
});
test('Webhook metadata is minimal and uninstall handling binds the signed shop identity',()=>{
 const raw=Buffer.from('{"id":123,"email":"must-not-persist@example.test"}'),event='00000000-0000-4000-8000-000000000000';
 const e=webhookEnvelope(raw,'store.myshopify.com','orders/create',event);assert.equal(Object.hasOwn(e,'email'),false);assert.equal(e.bodyHash.length,64);
 assert.throws(()=>webhookEnvelope(raw,'store.myshopify.com','app/uninstalled',event));assert.throws(()=>webhookEnvelope(raw,'evil.test','orders/create',event));
 assert.equal(webhookEnvelope(Buffer.from('{"myshopify_domain":"store.myshopify.com"}'),'store.myshopify.com','app/uninstalled',event).domain,'store.myshopify.com');
});
