import test from 'node:test';
import assert from 'node:assert/strict';
import { shopifyConfig,shopifyDomain,shopifyReadScopes } from '../src/lib/shopify-config.ts';
test('Shopify API hosts reject custom storefront domains, URLs and SSRF targets',()=>{
  assert.equal(shopifyDomain(' EXAMPLE.myshopify.com '),'example.myshopify.com');
  for(const host of ['metiveda.com','https://example.myshopify.com','example.myshopify.com.evil.test','localhost','127.0.0.1','example.myshopify.com:443','user@example.myshopify.com','-bad.myshopify.com','example.myshopify.com/path'])assert.throws(()=>shopifyDomain(host));
});
test('Shopify config requires an exact HTTPS callback, explicit API version and read-only scope',()=>{
  const env={SHOPIFY_CLIENT_ID:'TEST_CLIENT',SHOPIFY_CLIENT_SECRET:'TEST_SECRET',SHOPIFY_API_VERSION:'2026-10',SHOPIFY_SHOP_DOMAIN:'example.myshopify.com',SHOPIFY_REDIRECT_URI:'https://example.test/api/integrations/shopify/callback'};
  assert.equal(shopifyConfig(env).shop,'example.myshopify.com');
  assert.throws(()=>shopifyConfig({}));
  for(const uri of ['http://example.test/api/integrations/shopify/callback','https://user:pass@example.test/api/integrations/shopify/callback','https://example.test/api/integrations/shopify/callback?token=secret','https://example.test/other'])assert.throws(()=>shopifyConfig({...env,SHOPIFY_REDIRECT_URI:uri}));
  assert.throws(()=>shopifyConfig({...env,SHOPIFY_API_VERSION:'latest'}));
  assert.ok(shopifyReadScopes.every(scope=>scope.startsWith('read_')));
});
