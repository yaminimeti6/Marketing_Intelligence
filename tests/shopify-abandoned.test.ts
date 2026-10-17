import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ShopifyClient,ShopifyError} from '../src/lib/shopify.ts';
import {abandonedSummary} from '../src/lib/shopify-abandoned.ts';
const config={clientId:'TEST',clientSecret:'TEST',shop:'example.myshopify.com',version:'2026-10',redirectUri:'https://example.test/api/integrations/shopify/callback'};
const row=(id:string,completedAt:string|null=null)=>({id:`gid://shopify/AbandonedCheckout/${id}`,createdAt:'2026-10-02T00:00:00Z',updatedAt:'2026-10-03T00:00:00Z',completedAt,totalPriceSet:{shopMoney:{amount:'999.123456',currencyCode:'INR'}}});
test('Checkout discovery includes recovered records, uses bounded same-host pagination and omits customer data',async()=>{
 let calls=0;const api=new ShopifyClient(config,'TEST_TOKEN',async(input,init)=>{
  assert.equal(new URL(String(input)).hostname,config.shop);const body=JSON.parse(String(init?.body));assert.ok(!/customer|email|Address|abandonedCheckoutUrl|note/.test(body.query));assert.match(body.variables.query,/created_at:>=2026-10-01/);assert.equal(body.variables.after,calls===0?null:'next');calls++;
  return Response.json({data:{abandonedCheckouts:{nodes:[row(String(calls),calls===2?'2026-10-03T00:00:00Z':null)],pageInfo:{hasNextPage:calls===1,endCursor:'next'}}}});
 });
 const rows=await api.abandonedCheckouts('2026-10-01T00:00:00Z','2026-10-16T00:00:00Z');assert.equal(rows.length,2);assert.equal(calls,2);const summary=abandonedSummary(rows);assert.equal(summary.unrecovered,1);assert.equal(summary.recovered,1);assert.equal(summary.values[0].amount,'999.123456');
});
test('Checkout errors and malformed pagination cannot become successful empty reports',async()=>{
 const denied=new ShopifyClient(config,'TEST',async()=>Response.json({errors:[{message:'PRIVATE_DETAIL',extensions:{code:'ACCESS_DENIED'}}]}));await assert.rejects(()=>denied.abandonedCheckouts('2026-10-01','2026-10-16'),e=>e instanceof ShopifyError&&e.kind==='permission_denied');
 const loop=new ShopifyClient(config,'TEST',async()=>Response.json({data:{abandonedCheckouts:{nodes:[],pageInfo:{hasNextPage:true,endCursor:'same'}}}}));await assert.rejects(()=>loop.abandonedCheckouts('2026-10-01','2026-10-16'),e=>e instanceof ShopifyError&&e.kind==='invalid_response');
});
test('Checkout totals keep currencies distinct, preserve unknown money and do not imply lost revenue',()=>{
 const base={id:'fixture',createdAt:'2026-10-02',updatedAt:'2026-10-03',completedAt:null};
 const summary=abandonedSummary([{...base,amount:'100.000001',currency:'INR'},{...base,id:'2',amount:'0.000001',currency:'INR'},{...base,id:'3',amount:null,currency:'USD'}]);assert.equal(summary.unrecovered,3);assert.equal(summary.values[0].amount,'100.000002');assert.equal(summary.values[1].amount,null);assert.deepEqual(abandonedSummary([]),{unrecovered:0,recovered:0,values:[]});
});
