import {test} from 'node:test';
import assert from 'node:assert/strict';
import {summarizeShopify} from '../src/lib/shopify-report.ts';
const order=(amount:string,currency='INR')=>({resource:'orders',source:{test:false,cancelledAt:null,currencyCode:currency,currentSubtotalPriceSet:{shopMoney:{amount,currencyCode:currency}},totalRefundedSet:{shopMoney:{amount:'2.00',currencyCode:currency}}}});
test('Shopify subtotals retain precision, separate currencies and do not subtract refunds twice',()=>{
 const result=summarizeShopify([order('9007199254740993.123456'),order('0.000001'),order('4.00','USD')]);
 assert.equal(result.groups[0].subtotal,'9007199254740993.123457');
 assert.equal(result.groups[0].refunded,'4.000000');
 assert.equal(result.groups[1].subtotal,'4.000000');
});
test('Shopify excludes test and cancelled orders and treats missing money as unavailable',()=>{
 const a=order('3');const b=order('4');b.source.test=true;
 const cancelled={...order('5'),source:{...order('5').source,cancelledAt:'2026-10-16T00:00:00Z'}};
 const invalid={resource:'orders',source:{test:false,cancelledAt:null,currencyCode:'INR'}};
 const result=summarizeShopify([a,b,cancelled,invalid,{resource:'products',source:{id:'1'}}]);
 assert.equal(result.excluded,2);assert.equal(result.products,1);assert.equal(result.groups[0].orders,2);assert.equal(result.groups[0].subtotal,null);
});
test('An empty import does not fabricate a currency or financial total',()=>{
 assert.deepEqual(summarizeShopify([]),{groups:[],products:0,excluded:0});
});
