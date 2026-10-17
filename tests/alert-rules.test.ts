import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateRule,ruleDefinition,type RuleDefinition} from '../src/lib/alert-rules.ts';
import type {AnalyticsData} from '../src/lib/analytics.ts';
const now=new Date('2026-10-17T10:00:00Z');
function definition():RuleDefinition{return {name:'Spend check',provider:'meta',scope:'INR|Asia/Kolkata',account:'all',days:7,logic:'all',conditions:[{metric:'spend',operator:'gt',threshold:'100'}],cooldownHours:24};}
function data():AnalyticsData{return {today:'2026-10-17',errors:[],accounts:[{key:'meta:11111111-1111-4111-8111-111111111111:1',connectionId:'11111111-1111-4111-8111-111111111111',id:'1',name:'Fixture',currency:'INR',timezone:'Asia/Kolkata',provider:'meta',status:'connected',lastSync:now.toISOString()}],entities:[{key:'campaign',accountKey:'meta:11111111-1111-4111-8111-111111111111:1',id:'10',name:'Fixture campaign',status:'ACTIVE',provider:'meta'}],facts:[{entityKey:'campaign',accountKey:'meta:11111111-1111-4111-8111-111111111111:1',day:'2026-10-16',spend:'100.000001',impressions:'1000',clicks:'10',conversions:'2',value:'250'}],jobs:[{accountKey:'meta:11111111-1111-4111-8111-111111111111:1',start:'2026-10-01',end:'2026-10-17',created:now.toISOString(),finished:now.toISOString(),status:'succeeded',error:null}]};}
test('Rules use completed source-timezone days and exact money instead of floating point threshold comparisons',()=>{
 const r=definition(),d=data();let result=evaluateRule(r,d,now);assert.equal(result.status,'matched');assert.equal(result.start,'2026-10-10');assert.equal(result.end,'2026-10-16');
 d.facts[0].spend='9007199254740993.000001';r.conditions[0].threshold='9007199254740993.000002';assert.equal(evaluateRule(r,d,now).status,'not_matched');r.conditions[0].operator='lt';assert.equal(evaluateRule(r,d,now).status,'matched');
 d.facts.push({...d.facts[0],day:'2026-10-17',spend:'99999999999999999999'});assert.equal(evaluateRule(r,d,now).values.spend,'9007199254740993.000001');
});
test('Rules support AND and OR but never substitute missing metrics, stale imports or unverified scopes with zero',()=>{
 const r=definition(),d=data();r.conditions.push({metric:'roas',operator:'lt',threshold:'1'});assert.equal(evaluateRule(r,d,now).status,'not_matched');r.logic='any';assert.equal(evaluateRule(r,d,now).status,'matched');
 d.facts[0].spend=null;assert.equal(evaluateRule(r,d,now).status,'unavailable');
 d.facts[0].spend='100.000001';d.accounts[0].lastSync='2026-10-17T09:00:00Z';assert.equal(evaluateRule(r,d,now).status,'unavailable');
 d.accounts[0].lastSync=now.toISOString();d.jobs=[];assert.equal(evaluateRule(r,d,now).status,'unavailable');
 const other=data();r.scope='USD|UTC';assert.equal(evaluateRule(r,other,now).status,'unavailable');r.scope=definition().scope;other.accounts[0].status='reauthorization_required';assert.equal(evaluateRule(r,other,now).status,'unavailable');
});
test('Rule input rejects executable payloads, invalid metrics, unsupported windows and cross-provider account strings',()=>{
 const valid=definition();assert.equal(ruleDefinition(valid).name,'Spend check');for(const update of [{name:'bad\nname'},{scope:'INR|not/a/timezone'},{days:365},{cooldownHours:0},{account:'https://evil.test'},{account:'google_ads:11111111-1111-4111-8111-111111111111:1234567890'},{conditions:[]},{conditions:[{metric:'profit',operator:'gt',threshold:'0'}]},{conditions:[{metric:'spend',operator:'gt',threshold:'1e6'}]},{conditions:[{metric:'spend',operator:'gt',threshold:'=IMPORTDATA()'}]}])assert.throws(()=>ruleDefinition({...valid,...update}),/rule_input/);
});
