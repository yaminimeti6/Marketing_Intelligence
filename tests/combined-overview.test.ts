import {test} from 'node:test';
import assert from 'node:assert/strict';
import {combinedOverview} from '../src/lib/combined-overview.ts';
import {overviewInsights} from '../src/lib/overview-insights.ts';
import {combinedCsv} from '../src/lib/combined-export.ts';
import {reportQuery,type MetaReport} from '../src/lib/meta-report.ts';
import {reconcileShopify} from '../src/lib/shopify-reconciliation.ts';
import type {ShopifyReport} from '../src/server/shopify-report.ts';
function reports(){
 const start='2026-10-01',end='2026-10-16';
 const meta:MetaReport={schemaReady:true,rangeSchemaReady:true,error:null,canSync:true,query:reportQuery({start,end},end),accounts:[{key:'connection:1',connectionId:'connection',id:'1',name:'Fixture account',currency:'INR',timezone:'Asia/Kolkata',lastSync:'2026-10-16T10:00:00Z',status:'connected'}],facts:[{accountKey:'connection:1',entityId:'1',level:'campaign',start,end,source:{spend:'10.123456',impressions:'10',clicks:'1',actions:[],action_values:[{action_type:'purchase',value:'20'}]}},{accountKey:'connection:1',entityId:'2',level:'ad',start,end,source:{spend:'999'}}],ranges:[],entities:[],jobs:[{accountKey:'connection:1',start,end,status:'succeeded',created:'2026-10-16T09:00:00Z',finished:'2026-10-16T10:00:00Z',error:null}]};
 const bag=(amount:string)=>({shopMoney:{amount,currencyCode:'INR'}});
 const reconciliation=reconcileShopify([{resource:'orders',source:{id:'fixture',createdAt:'2026-10-02T00:00:00Z',test:false,cancelledAt:null,taxesIncluded:false,currentTotalPriceSet:bag('100'),totalReceivedSet:bag('100'),totalRefundedSet:bag('10'),netPaymentSet:bag('90'),lineItemsComplete:true,lineItems:{nodes:[{isGiftCard:false,currentQuantity:1,originalUnitPriceSet:bag('100'),priceAfterAllDiscountsBeforeTaxesSet:bag('100')}]}}}],'INR','Asia/Kolkata',true,start,end);
 const shopify:ShopifyReport={available:true,from:start,to:end,stores:[{id:'store',name:'Fixture store',domain:'fixture.myshopify.com',currency:'INR',timezone:'Asia/Kolkata',lastSync:'2026-10-16T10:00:00Z',since:start,until:end,ready:true,pending:false,reconciliation,sales:{rows:[],detailsReady:true,eligibleOrders:1,ordered:1,retained:1,excluded:0,filtered:0},activity:{configured:false,lastEvent:null,pageViews:0,views:0,cart:0,cartUnits:0,checkout:0,products:{}},abandoned:{status:'not_imported',checkedAt:null,since:null,until:null,rows:[]},groups:[],products:0,excluded:0}]};return {meta,shopify};
}
test('Combined overview shares dates, keeps attribution separate and never doubles Meta hierarchy spend',()=>{
 const {meta,shopify}=reports(),report=combinedOverview(meta,shopify);assert.equal(report.meta.spend,'10.123456');assert.equal(report.meta.revenue,'20');assert.equal(report.shopify.merchandise,'100.000000');assert.equal(report.shopify.netPayments,'90.000000');assert.equal(report.compatible,true);assert.equal(report.mer,null);assert.match(report.ratioReason,/complete Shopify/);
});
test('Source coverage and date mismatches cannot fabricate zero or combined ratios',()=>{
 const {meta,shopify}=reports();meta.jobs[0].status='queued';let report=combinedOverview(meta,shopify);assert.equal(report.meta.spend,null);assert.equal(report.shopify.merchandise,'100.000000');shopify.from='2026-09-01';report=combinedOverview(meta,shopify);assert.equal(report.shopify.merchandise,null);assert.equal(report.mer,null);
});
test('Currency and timezone mismatch blocks comparison without FX or mixing values',()=>{
 const {meta,shopify}=reports();shopify.stores[0].timezone='UTC';assert.equal(combinedOverview(meta,shopify).compatible,false);shopify.stores[0].currency='USD';const report=combinedOverview(meta,shopify);assert.equal(report.shopify.merchandise,null);assert.equal(report.meta.currency,'INR');assert.equal(report.mer,null);
});
test('Completed empty imports differ from missing financial imports and unknown stores',()=>{
 const {meta,shopify}=reports();shopify.stores[0].reconciliation.orders=[];shopify.stores[0].reconciliation.groups=[];assert.equal(combinedOverview(meta,shopify).shopify.merchandise,'0.000000');shopify.stores[0].reconciliation.ready=false;assert.equal(combinedOverview(meta,shopify).shopify.merchandise,null);const report=combinedOverview(meta,shopify,'foreign-store');assert.equal(report.storeId,'');assert.ok(report.storeError);assert.equal(report.shopify.netPayments,null);
});
test('Oldest account timestamp stays unavailable if one selected account has never completed sync',()=>{
 const {meta,shopify}=reports();meta.accounts.push({...meta.accounts[0],key:'connection:2',lastSync:null});const report=combinedOverview(meta,shopify);assert.equal(report.meta.lastSync,null);assert.equal(report.meta.ready,false);
});

test('Overview trends group real source dates and reconcile to imported merchandise without treating missing imports as zero',()=>{
 const {meta,shopify}=reports();meta.facts[0].start=meta.facts[0].end='2026-10-02';
 const daily=overviewInsights(meta,shopify,'store');assert.equal(daily.length,16);assert.equal(daily.find(r=>r.period==='2026-10-02')?.metaSpend,'10.123456');assert.equal(daily.find(r=>r.period==='2026-10-02')?.shopifyMerchandise,'100.000000');
 const monthly=overviewInsights(meta,shopify,'store','month');assert.equal(monthly.length,1);assert.equal(monthly[0].shopifyMerchandise,'100.000000');assert.equal(monthly[0].metaSpend,'10.123456');
 shopify.stores[0].ready=false;assert.equal(overviewInsights(meta,shopify,'store')[0].shopifyMerchandise,null);
});

test('Combined CSV retains exact source values and separate coverage instead of inventing a unified revenue or MER',()=>{
 const {meta,shopify}=reports(),report=combinedOverview(meta,shopify);report.trend=overviewInsights(meta,shopify,report.storeId);
 const exported=combinedCsv(report);assert.ok(exported.csv.includes('10.123456'));assert.ok(exported.csv.includes('100.000000'));assert.ok(exported.csv.includes('imported subset'));assert.ok(exported.csv.includes('"MER","N/A","unavailable"'));assert.ok(exported.csv.includes('not actual Shopify sales'));assert.equal(exported.count,9+16*2);
 assert.throws(()=>combinedCsv({...report,dateError:'Invalid dates'}));assert.throws(()=>combinedCsv({...report,storeError:'Unavailable store'}));
});
