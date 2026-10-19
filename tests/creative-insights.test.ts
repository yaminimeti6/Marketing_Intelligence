import {test} from 'node:test';
import assert from 'node:assert/strict';
import {creativeInsights} from '../src/lib/creative-insights.ts';
import {reportQuery,type MetaReport} from '../src/lib/meta-report.ts';
function fixture():MetaReport {
 const q=reportQuery({start:'2026-10-12',end:'2026-10-14',compare:'true',level:'ads'},'2026-10-19');
 return {query:q,accounts:[{key:'a',connectionId:'c',id:'a',name:'Account',currency:'INR',timezone:'Asia/Kolkata',lastSync:null,status:'connected'}],entities:[{accountKey:'a',id:'ad',level:'ads',name:'Ad',campaignId:null,adsetId:null,status:'ACTIVE',dailyBudget:null,lifetimeBudget:null}],facts:[{accountKey:'a',entityId:'ad',level:'ad',start:q.start,end:q.end,source:{spend:'100',impressions:'3000',clicks:'30',actions:[{action_type:'purchase',value:'1'}]}},{accountKey:'a',entityId:'ad',level:'ad',start:q.priorStart,end:q.priorEnd,source:{spend:'100',impressions:'3000',clicks:'60',actions:[{action_type:'purchase',value:'2'}]}}],ranges:[{accountKey:'a',entityId:'ad',level:'ad',start:q.start,end:q.end,source:{reach:'1000'}}],jobs:[{accountKey:'a',start:q.priorStart,end:q.end,status:'succeeded',created:'2026-10-19T00:00:00Z',finished:'2026-10-19T00:01:00Z',error:null}],schemaReady:true,rangeSchemaReady:true,error:null,canSync:true};
}
test('fatigue requires completed comparable periods and declining performance',()=>{
 const report=fixture(),row=creativeInsights(report)[0];assert.equal(row.signal,'review_fatigue');assert.equal(row.frequency,3);assert.equal(row.ctrChange,-50);
 report.jobs=[];assert.equal(creativeInsights(report)[0].signal,'coverage_missing');assert.equal(creativeInsights(report)[0].metrics.spend,null);
});
test('missing prior coverage and small samples never become a fatigue diagnosis',()=>{
 const report=fixture();report.jobs[0].start=report.query.start;assert.equal(creativeInsights(report)[0].signal,'insufficient_evidence');
 const small=fixture();small.facts[0].source.impressions='100';assert.equal(creativeInsights(small)[0].signal,'insufficient_evidence');
});
test('frequency is unavailable without exact ad-level reach',()=>{
 const report=fixture();report.ranges=[];const row=creativeInsights(report)[0];assert.equal(row.frequency,null);assert.equal(row.signal,'review_fatigue');
 report.facts[0].source.actions=[{action_type:'purchase',value:'2'}];assert.equal(creativeInsights(report)[0].signal,'no_signal');
});
