import test from 'node:test';
import assert from 'node:assert/strict';
import {analyticsView,analyticsCsv,type AnalyticsData} from '../src/lib/analytics.ts';
function fixture():AnalyticsData{return {today:'2026-10-16',errors:[],accounts:[{key:'meta:a:1',connectionId:'a',id:'1',name:'Meta',currency:'INR',timezone:'Asia/Kolkata',lastSync:'2026-10-16T00:00:00Z',status:'connected',provider:'meta'},{key:'meta:b:2',connectionId:'b',id:'2',name:'Foreign Meta',currency:'USD',timezone:'America/New_York',lastSync:null,status:'connected',provider:'meta'}],entities:[{key:'meta:a:1:10',accountKey:'meta:a:1',id:'10',name:'Active campaign',status:'ACTIVE',provider:'meta'},{key:'meta:a:1:11',accountKey:'meta:a:1',id:'11',name:'=Paused',status:'PAUSED',provider:'meta'}],facts:[{entityKey:'meta:a:1:10',accountKey:'meta:a:1',day:'2026-10-16',spend:'12.10',impressions:'100',clicks:'10',conversions:'2',value:'30'},{entityKey:'meta:a:1:11',accountKey:'meta:a:1',day:'2026-10-16',spend:'20.20',impressions:'200',clicks:'20',conversions:'1',value:'40'},{entityKey:'meta:a:1:10',accountKey:'meta:a:1',day:'2026-10-15',spend:'6.05',impressions:'50',clicks:'5',conversions:'1',value:'15'}],jobs:[{accountKey:'meta:a:1',start:'2026-10-15',end:'2026-10-16',status:'succeeded',created:'2026-10-16T00:00:00Z',finished:'2026-10-16T00:00:00Z',error:null}]};}
const dates={start:'2026-10-16',end:'2026-10-16'};
test('Analytics applies campaign filters to KPIs, comparison, trend, rows and export with currency isolation',()=>{
 const data=fixture(),query={...dates,status:'ACTIVE',compare:'true',columns:'spend,clicks'},v=analyticsView(data,query);
 assert.equal(v.accounts.length,1);assert.equal(v.totals.spend,'12.10');assert.equal(v.previous.spend,'6.05');assert.equal(v.rows.length,1);assert.equal(v.trend[0].spend,'12.10');assert.equal(v.totals.ctr,10);
 const csv=analyticsCsv(data,query);assert.equal(csv.count,1);assert.ok(csv.csv.includes('12.10'));assert.ok(!csv.csv.includes('Paused'));assert.ok(csv.csv.includes('Ad spend'));assert.ok(!csv.csv.includes('Provider ROAS'));
 assert.equal(analyticsView(data,{...dates,scope:'USD|America/New_York'}).totals.spend,null);
 assert.equal(analyticsView(data,{...dates,scope:'EUR|UTC'}).known,false);
});
test('Analytics distinguishes verified zero, missing coverage, failed latest sync and disconnected access',()=>{
 const data=fixture();assert.equal(analyticsView(data,{...dates,q:'no match'}).totals.spend,'0');
 data.jobs=[];assert.equal(analyticsView(data,dates).totals.spend,null);
 data.jobs=fixture().jobs;data.jobs.push({...data.jobs[0],status:'failed',created:'2026-10-16T01:00:00Z'});assert.equal(analyticsView(data,dates).known,false);
 data.jobs=fixture().jobs;data.accounts[0].status='reauthorization_required';assert.equal(analyticsView(data,dates).known,false);
});
test('CSV neutralizes spreadsheet formulas',()=>{
 const csv=analyticsCsv(fixture(),{...dates,status:'PAUSED'}).csv;assert.ok(csv.includes("'=Paused"));
});
test('Analytics sorting preserves exact large decimal ordering and grouping includes empty days',()=>{
 const data=fixture();data.facts[0].spend='9007199254740993.01';data.facts[1].spend='9007199254740993.02';const v=analyticsView(data,dates);assert.equal(v.rows[0].id,'11');assert.equal(v.totals.spend,'18014398509481986.03');
 const grouped=analyticsView(data,{start:'2026-10-15',end:'2026-10-16',group:'week'});assert.equal(grouped.trend.length,1);assert.equal(grouped.trend[0].day,'2026-10-12');
});

test('Report dimensions aggregate filtered campaigns with matching CSV and trend totals',()=>{
 const data=fixture(),account=analyticsView(data,{...dates,dimension:'account'});assert.equal(account.rows.length,1);assert.equal(account.rows[0].metrics.spend,'32.30');assert.equal(account.totals.spend,account.rows[0].metrics.spend);
 const period=analyticsView(data,{start:'2026-10-15',end:'2026-10-16',dimension:'period',group:'month',status:'ACTIVE'});assert.equal(period.rows.length,1);assert.equal(period.rows[0].name,'2026-10');assert.equal(period.rows[0].metrics.spend,'18.15');assert.equal(period.trend[0].spend,'18.15');
 const csv=analyticsCsv(data,{...dates,dimension:'account'});assert.ok(csv.csv.includes('"account"'));assert.ok(csv.csv.includes('32.30'));assert.equal(csv.count,1);
});
