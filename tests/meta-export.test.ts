import test from 'node:test';
import assert from 'node:assert/strict';
import {makeMetaCsv,safeCsvCell} from '../src/lib/meta-export.ts';
import {metaTableRows,reportQuery,type MetaReport,type ReportEntity} from '../src/lib/meta-report.ts';
const account={key:'c:1',connectionId:'c',id:'1',name:'=HYPERLINK("evil")',currency:'INR',timezone:'Asia/Kolkata',status:'connected',lastSync:'2026-10-16T06:00:00Z'};
const entity:ReportEntity={accountKey:'c:1',id:'10',name:'Test, "campaign"',level:'campaigns',campaignId:null,adsetId:null,status:'ACTIVE',dailyBudget:null,lifetimeBudget:null};
function report():MetaReport{return {accounts:[account],entities:[entity,{...entity,id:'11',name:'Other campaign',status:'PAUSED'}],facts:[{accountKey:account.key,entityId:'10',level:'campaign',start:'2026-10-15',end:'2026-10-15',source:{spend:'9007199254740993.10',impressions:'10',clicks:'1',actions:[{action_type:'purchase',value:'1'}],action_values:[{action_type:'purchase',value:'4.50'}]}}],ranges:[],jobs:[{accountKey:account.key,start:'2026-10-15',end:'2026-10-15',status:'succeeded',created:'2026-10-16T06:00:00Z',finished:'2026-10-16T06:01:00Z',error:null}],query:reportQuery({start:'2026-10-15',end:'2026-10-15'},'2026-10-16'),schemaReady:true,rangeSchemaReady:true,canSync:true,error:null};}
test('production CSV matches shared filtered hierarchy rows and preserves exact money and provenance',()=>{
 const r=report();r.query.status='ACTIVE';const selected=metaTableRows(r);assert.equal(selected.length,1);
 const result=makeMetaCsv(r,'name','2026-10-16T07:00:00Z');assert.equal(result.count,1);assert.equal(result.complete,true);assert.match(result.csv,/9007199254740993\.10/);assert.match(result.csv,/Meta Marketing API/);assert.match(result.csv,/Asia\/Kolkata/);assert.match(result.csv,/Test, ""campaign""/);assert.ok(!result.csv.includes('Other campaign'));assert.ok(!result.csv.includes('DEMO DATA'));assert.match(result.csv,/"'=HYPERLINK/);
});
test('exports distinguish incomplete metrics from valid zero activity, reject unavailable data and retain metadata on empty reports',()=>{
 const r=report();r.jobs=[];assert.match(makeMetaCsv(r).csv,/incomplete/);assert.equal(metaTableRows(r)[0].metrics.spend,null);r.jobs=report().jobs;r.facts=[];assert.equal(metaTableRows(r)[0].metrics.spend,'0');r.entities=[];const exported=makeMetaCsv(r);assert.equal(exported.count,0);assert.equal(exported.csv.trim().split('\r\n').length,2);r.error='unavailable';assert.throws(()=>makeMetaCsv(r));assert.throws(()=>makeMetaCsv({...report(),accounts:[]}));
});
test('CSV formula guards include leading whitespace and quotes, and row filters preserve campaign/adset distinction',()=>{
 for(const input of ['=1+1','\t@SUM(1)',' \r-2','+1'])assert.ok(safeCsvCell(input).startsWith('"\''));assert.equal(safeCsvCell('a"b'),'"a""b"');assert.equal(safeCsvCell(null),'"N/A"');const r=report();r.query.level='adsets';r.query.parent='10';r.entities.push({...entity,id:'12',name:'Child',level:'adsets',campaignId:'10'});assert.equal(metaTableRows(r)[0].entity.id,'12');r.query.parent='wrong';assert.equal(metaTableRows(r).length,0);
});

import {sameOriginPost} from '../src/lib/request-origin.ts';
test('export origin validation supports Next loopback host reconstruction but denies cross-origin, opaque and insecure remote origins',()=>{
 const request=(origin:string,host='127.0.0.1:3001')=>new Request('http://localhost:3001/api/reports/meta/export',{headers:{origin,host}});
 assert.equal(sameOriginPost(request('http://127.0.0.1:3001')),true);assert.equal(sameOriginPost(request('https://app.example.test','app.example.test')),true);
 for(const origin of ['null','https://evil.invalid','http://127.0.0.1:3002','http://127.0.0.1:3001/path'])assert.equal(sameOriginPost(request(origin)),false);
 assert.equal(sameOriginPost(request('http://app.example.test','app.example.test')),false);
});
