import {test} from 'node:test';
import assert from 'node:assert/strict';
import {reconcileShopify} from '../src/lib/shopify-reconciliation.ts';
const bag=(amount:string,currencyCode='INR')=>({shopMoney:{amount,currencyCode}});
function order(){return {resource:'orders',source:{id:'gid://shopify/Order/1',createdAt:'2026-10-15T20:00:00Z',test:false,cancelledAt:null as string|null,currencyCode:'USD',taxesIncluded:false,displayFinancialStatus:'PARTIALLY_REFUNDED',lineItemsComplete:true,
 originalTotalPriceSet:bag('330'),currentTotalPriceSet:bag('186'),currentTotalDiscountsSet:bag('40'),currentTotalTaxSet:bag('16'),currentShippingPriceSet:bag('10'),totalReceivedSet:bag('300'),totalRefundedSet:bag('114'),netPaymentSet:bag('186'),totalOutstandingSet:bag('0'),totalRefundedShippingSet:bag('0'),
 lineItems:{nodes:[{isGiftCard:false,currentQuantity:2,quantity:3,originalUnitPriceSet:bag('100'),priceAfterAllDiscountsBeforeTaxesSet:bag('160')}]}}};}
test('Reconciliation preserves discounts/refunds separately and checks the exact payment identity in shop currency',()=>{
 const result=reconcileShopify([order()],'INR','Asia/Kolkata',true);const row=result.orders[0];assert.equal(row.currency,'INR');assert.equal(row.status,'matched');assert.equal(row.difference,'0.000000');assert.equal(row.values.grossItems,'200.000000');assert.equal(row.values.itemDiscounts,'40.000000');assert.equal(row.values.items,'160.000000');assert.equal(row.values.net,'186.000000');assert.equal(row.values.refunded,'114.000000');
});
test('Cancelled payments remain included while retained merchandise excludes cancelled items and gift cards',()=>{
 const cancelled=order();cancelled.source.cancelledAt='2026-10-16T00:00:00Z';cancelled.source.netPaymentSet=bag('0');cancelled.source.totalRefundedSet=bag('300');const a=reconcileShopify([cancelled],'INR','UTC',true);assert.equal(a.orders.length,1);assert.equal(a.orders[0].values.items,'0.000000');assert.equal(a.orders[0].status,'matched');
 const gift=order();gift.source.lineItems.nodes.push({isGiftCard:true,currentQuantity:1,quantity:1,originalUnitPriceSet:bag('50'),priceAfterAllDiscountsBeforeTaxesSet:bag('50')});assert.equal(reconcileShopify([gift],'INR','UTC',true).orders[0].values.items,'160.000000');
});
test('Tax-inclusive shipping is a source amount and COD/unpaid balances do not become received sales',()=>{
 const fixture=order();fixture.source.taxesIncluded=true;fixture.source.totalReceivedSet=bag('0');fixture.source.totalRefundedSet=bag('0');fixture.source.netPaymentSet=bag('0');fixture.source.totalOutstandingSet=bag('186');fixture.source.displayFinancialStatus='PENDING';const row=reconcileShopify([fixture],'INR','UTC',true).orders[0];assert.equal(row.values.tax,'16.000000');assert.equal(row.values.shipping,'10.000000');assert.equal(row.values.net,'0.000000');assert.equal(row.values.outstanding,'186.000000');assert.equal(row.values.grossItems,null);assert.equal(row.values.itemDiscounts,null);assert.equal(row.status,'matched');
});
test('Missing or mixed-currency payment fields are incomplete; negative net and exact small differences survive',()=>{
 const missing=order();missing.source.netPaymentSet=bag('186','USD');assert.equal(reconcileShopify([missing],'INR','UTC',true).orders[0].status,'incomplete');
 const negative=order();negative.source.totalReceivedSet=bag('0');negative.source.totalRefundedSet=bag('10.123456');negative.source.netPaymentSet=bag('-10.123456');const row=reconcileShopify([negative],'INR','UTC',true).orders[0];assert.equal(row.values.net,'-10.123456');assert.equal(row.status,'matched');negative.source.netPaymentSet=bag('-10.123455');assert.equal(reconcileShopify([negative],'INR','UTC',true).orders[0].difference,'0.000001');
});
test('Filters use order creation in store timezone; tests, incomplete imports and empty datasets never claim a match',()=>{
 assert.equal(reconcileShopify([order()],'INR','Asia/Kolkata',true,'2026-10-16','2026-10-16').orders.length,1);assert.equal(reconcileShopify([order()],'INR','UTC',true,'2026-10-16','2026-10-16').orders.length,0);assert.equal(reconcileShopify([order()],'INR','UTC',false).orders.length,0);assert.deepEqual(reconcileShopify([],'INR','UTC',true).groups,[]);const testOrder=order();testOrder.source.test=true;assert.equal(reconcileShopify([testOrder],'INR','UTC',true).excluded,1);
});
test('Large monetary values retain precision and currencies do not merge',()=>{
 const a=order();a.source.totalReceivedSet=bag('9007199254740993.123456');a.source.totalRefundedSet=bag('0');a.source.netPaymentSet=bag('9007199254740993.123456');const b=order();b.source.id='gid://shopify/Order/2';b.source.currentTotalPriceSet=bag('100','USD');const result=reconcileShopify([a,b],'INR','UTC',true);assert.equal(result.groups.length,2);assert.equal(result.groups[0].values.received,'9007199254740993.123456');assert.equal(result.groups[1].values.net,null);
});
