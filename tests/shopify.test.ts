import test from 'node:test';
import assert from 'node:assert/strict';
import {ShopifyClient,ShopifyError,ShopifySession,shopifySdk,validateShopifySession} from '../src/lib/shopify.ts';
import type {ShopifyConfig} from '../src/lib/shopify-config.ts';
const config:ShopifyConfig={clientId:'TEST_ID',clientSecret:'TEST_SECRET',shop:'example.myshopify.com',version:'2026-10',redirectUri:'https://example.test/api/integrations/shopify/callback'};
test('official Shopify OAuth produces signed HttpOnly cookies and read-only scopes without exposing secret',async()=>{
 const sdk=shopifySdk(config);
 const response:Response=await sdk.auth.begin({shop:config.shop,callbackPath:'/api/integrations/shopify/callback',isOnline:false,rawRequest:new Request('https://example.test/api/integrations/shopify/start',{method:'POST',headers:{'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'}})});
 const location=response.headers.get('location')!;assert.ok(location);const url=new URL(location);assert.equal(url.hostname,config.shop);assert.equal(url.searchParams.get('scope'),'read_orders,read_products,read_reports');assert.ok(url.searchParams.get('state'));assert.ok(!location.includes(config.clientSecret));assert.ok(response.headers.get('set-cookie')?.toLowerCase().includes('httponly'));assert.ok(response.headers.get('set-cookie')?.toLowerCase().includes('secure'));
 const cookie=response.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');
 await assert.rejects(()=>sdk.auth.callback({rawRequest:new Request(`https://example.test/api/integrations/shopify/callback?shop=${config.shop}&code=FAKE&state=${url.searchParams.get('state')}&hmac=${'0'.repeat(64)}&timestamp=${Math.floor(Date.now()/1000)}`,{headers:{cookie,'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'}}),expiring:true}));
});
test('Shopify offline sessions require granted scopes, exact shop, valid access and refresh expiry',()=>{
 const session=new ShopifySession({id:'offline_test',shop:config.shop,state:'state',isOnline:false,accessToken:'TEST_TOKEN',refreshToken:'TEST_REFRESH',scope:'read_orders,read_products',expires:new Date(Date.now()+3600000),refreshTokenExpires:new Date(Date.now()+86400000)});
 assert.doesNotThrow(()=>validateShopifySession(session,config.shop));assert.throws(()=>validateShopifySession(session,'other.myshopify.com'));session.expires=new Date('invalid');assert.throws(()=>validateShopifySession(session,config.shop));session.expires=new Date(Date.now()+3600000);session.scope='read_products';assert.throws(()=>validateShopifySession(session,config.shop));
});
test('GraphQL empty responses and pagination are real states; tokens stay in headers and cross-host next links are ignored',async()=>{
 let calls=0;
 const api=new ShopifyClient(config,'PRIVATE_TEST_TOKEN',async(input,init)=>{calls++;assert.equal(new URL(String(input)).host,config.shop);assert.equal(init?.redirect,'error');assert.ok(!String(input).includes('PRIVATE_TEST_TOKEN'));assert.equal((init?.headers as Record<string,string>)['X-Shopify-Access-Token'],'PRIVATE_TEST_TOKEN');const body=JSON.parse(init?.body as string);assert.ok(!/customer\s*\{|email|billingAddress/.test(body.query));return Response.json({data:{orders:{nodes:calls===1?[{id:'gid://shopify/Order/1',lineItems:{nodes:[],pageInfo:{hasNextPage:false,endCursor:null}}}]:[],pageInfo:{hasNextPage:calls===1,endCursor:calls===1?'cursor':null}}},next:'https://evil.test/steal'});});
 const rows=[];for await(const page of api.records('orders','2026-10-01T00:00:00Z','2026-10-16T00:00:00Z'))rows.push(...page);assert.equal(rows.length,1);assert.equal(calls,2);
});
test('Shopify GraphQL partial errors, throttling, network failures and version fallback never claim success or leak body text',async()=>{
 for(const [status,body,kind] of [[401,{},'reauthorization_required'],[403,{},'permission_denied'],[429,{},'rate_limited'],[200,{data:{shop:{}},errors:[{message:'PRIVATE_PROVIDER_DETAIL',extensions:{code:'THROTTLED'}}]},'rate_limited']] as const){const api=new ShopifyClient(config,'TOKEN',async()=>Response.json(body,{status}));await assert.rejects(()=>api.identity(),e=>e instanceof ShopifyError&&e.kind===kind&&!e.message.includes('PRIVATE_PROVIDER_DETAIL'));}
 const version=new ShopifyClient(config,'TOKEN',async()=>Response.json({data:{shop:{}}},{headers:{'x-shopify-api-version':'2027-01'}}));await assert.rejects(()=>version.identity(),e=>e instanceof ShopifyError&&e.kind==='configuration');
 const network=new ShopifyClient(config,'TOKEN',async()=>{throw new Error('PRIVATE_NETWORK_DETAIL');});await assert.rejects(()=>network.identity(),e=>e instanceof ShopifyError&&e.message==='Shopify unavailable');
});

test('Order line pagination is complete and refuses a changing order snapshot',async()=>{
 const line=(id:string)=>({id:`gid://shopify/LineItem/${id}`,quantity:2,currentQuantity:1});
 const initial={id:'gid://shopify/Order/1',updatedAt:'2026-10-16T00:00:00Z',lineItems:{nodes:[line('1')],pageInfo:{hasNextPage:true,endCursor:'lines-1'}}};
 for(const changed of [false,true]){
  let calls=0;
  const api=new ShopifyClient(config,'TEST_TOKEN',async(_input,init)=>{
   calls++;const {query,variables}=JSON.parse(init?.body as string);
   if(query.includes('NorthstarOrderLines')){assert.equal(variables.after,'lines-1');assert.equal(variables.id,initial.id);return Response.json({data:{order:{updatedAt:changed?'2026-10-16T01:00:00Z':initial.updatedAt,lineItems:{nodes:[line('2')],pageInfo:{hasNextPage:false,endCursor:null}}}}});}
   return Response.json({data:{orders:{nodes:[initial],pageInfo:{hasNextPage:false,endCursor:null}}}});
  });
  const collect=async()=>{const result=[];for await(const page of api.records('orders','2026-10-01T00:00:00Z','2026-10-16T00:00:00Z'))result.push(...page);return result;};
  if(changed)await assert.rejects(collect,e=>e instanceof ShopifyError&&e.kind==='unavailable');else{const result=await collect();assert.equal(result[0].lineItemsComplete,true);assert.equal((result[0].lineItems as {nodes:unknown[]}).nodes.length,2);}
  assert.equal(calls,2);
 }
});
