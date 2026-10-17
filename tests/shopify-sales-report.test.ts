import test from 'node:test';
import assert from 'node:assert/strict';
import {parseSalesReport,salesStatement,salesWindow,netSalesForRange,verifiedMer} from '../src/lib/shopify-sales-report.ts';
const range={from:'2026-10-15',to:'2026-10-16'};
function response(){return {shopifyqlQuery:{parseErrors:[],tableData:{columns:[{name:'day',dataType:'DAY_TIMESTAMP'},{name:'net_sales',dataType:'MONEY'}],rows:[{day:'2026-10-15',net_sales:'9007199254740993.123456'},{day:'2026-10-16',net_sales:'-10.000001'}]}}};}
test('Sales reports preserve exact signed event-date amounts and selected-range coverage',()=>{
 const report=parseSalesReport(response(),range,'INR','Asia/Kolkata');assert.equal(netSalesForRange(report,range.from,range.to,'INR','Asia/Kolkata'),'9007199254740983.123455');assert.equal(netSalesForRange(report,range.to,range.to,'INR','Asia/Kolkata'),'-10.000001');assert.equal(netSalesForRange(report,'2026-10-14',range.to,'INR','Asia/Kolkata'),null);assert.equal(netSalesForRange(report,range.from,range.to,'USD','Asia/Kolkata'),null);assert.equal(netSalesForRange({...report,status:'permission_denied'},range.from,range.to,'INR','Asia/Kolkata'),null);assert.equal(netSalesForRange(report,range.from,range.to,'INR','Asia/Kolkata',Date.now()+16*60000),null);
});
test('Malformed, partial, duplicate, out-of-window and parse-error responses cannot become sales totals',()=>{
 for(const mutate of [(r:ReturnType<typeof response>)=>r.shopifyqlQuery.tableData.rows.pop(),(r:ReturnType<typeof response>)=>r.shopifyqlQuery.tableData.rows.push(r.shopifyqlQuery.tableData.rows[0]),(r:ReturnType<typeof response>)=>r.shopifyqlQuery.tableData.rows[0].net_sales='NaN',(r:ReturnType<typeof response>)=>r.shopifyqlQuery.tableData.columns.pop(),(r:ReturnType<typeof response>)=>r.shopifyqlQuery.tableData.rows[0].day='2026-10-14']){const r=response();mutate(r);assert.throws(()=>parseSalesReport(r,range,'INR','UTC'));}
 const r=response();(r.shopifyqlQuery.parseErrors as string[]).push('invalid query');assert.throws(()=>parseSalesReport(r,range,'INR','UTC'));
});
test('Reporting uses the preceding 30 closed shop-timezone days and validates query dates',()=>{
 assert.deepEqual(salesWindow('Asia/Kolkata',new Date('2026-10-17T01:00:00Z')),{from:'2026-09-17',to:'2026-10-16'});assert.throws(()=>salesStatement('2026-02-30','2026-03-01'));assert.throws(()=>salesStatement('2026-10-17','2026-10-16'));assert.match(salesStatement(range.from,range.to),/^FROM sales SHOW net_sales TIMESERIES day/);
});
test('Meta-only MER requires confirmed coverage, positive spend and matching dates/scopes',()=>{
 const channels=[{provider:'meta',spend:'150',ready:true,accounts:1}];
 assert.equal(verifiedMer('300',channels,['meta'],true,true),2);
 assert.equal(verifiedMer('-300',channels,['meta'],true,true),-2);
 assert.equal(verifiedMer('0',channels,['meta'],true,true),0);
 assert.equal(verifiedMer('300',channels,[],true,true),null);
 assert.equal(verifiedMer('300',[{...channels[0],spend:'0'}],['meta'],true,true),null);
 assert.equal(verifiedMer('300',[{...channels[0],ready:false}],['meta'],true,true),null);
 assert.equal(verifiedMer('300',channels,['meta'],false,true),null);
 assert.equal(verifiedMer('300',channels,['meta'],true,false),null);
 assert.equal(verifiedMer(null,channels,['meta'],true,true),null);
 assert.equal(verifiedMer('300',channels,['unsupported'],true,true),null);
});
