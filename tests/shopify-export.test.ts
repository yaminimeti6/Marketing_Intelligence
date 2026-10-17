import test from 'node:test';
import assert from 'node:assert/strict';
import {shopifyCsv} from '../src/lib/shopify-export.ts';
import {filteredProductRows} from '../src/lib/shopify-products.ts';
import type {ShopifyReport} from '../src/server/shopify-report.ts';
test('Shopify CSV shares product filtering and sorting, includes precision and coverage, and refuses incomplete imports',()=>{
 const rows=[{id:'1',title:'=Active',status:'ACTIVE',currency:'INR',orders:1,ordered:2,retained:1,amount:'1234567890123456.123456'},{id:'2',title:'Archived',status:'ARCHIVED',currency:'INR',orders:0,ordered:0,retained:0,amount:'0.000000'}];
 const store={id:'test',name:'Test store',timezone:'Asia/Kolkata',ready:true,sales:{detailsReady:true,rows}};
 const report={available:true,from:'2026-10-01',to:'2026-10-16',stores:[store]} as unknown as ShopifyReport;
 const csv=shopifyCsv(report,'test','active','ACTIVE','name');assert.equal(csv.count,filteredProductRows(rows,'active','ACTIVE','name').length);assert.equal(csv.count,1);assert.ok(csv.csv.includes("'=Active"));assert.ok(csv.csv.includes('1234567890123456.123456'));assert.ok(csv.csv.includes('not complete Shopify Analytics Net Sales'));assert.ok(!csv.csv.includes('Archived'));
 store.ready=false;assert.throws(()=>shopifyCsv(report,'test'));assert.throws(()=>shopifyCsv(report,'foreign-store'));
});
