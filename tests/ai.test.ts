import {test} from 'node:test';
import assert from 'node:assert/strict';
import {aiConfiguration,aiInput,aiReportContext,generateAi} from '../src/lib/ai.ts';
import {reportQuery,type MetaReport} from '../src/lib/meta-report.ts';
const env={OPENAI_API_KEY:'sk-test-only-not-a-real-key'};
test('AI input rejects unsupported modes, oversized prompts and configuration',()=>{
 const form=new FormData();form.set('mode','copilot');form.set('prompt','Explain my report');form.set('language','Gujarati');assert.equal(aiInput(form).language,'Gujarati');form.set('prompt','a'.repeat(2001));assert.throws(()=>aiInput(form));form.set('mode','execute_budget');assert.throws(()=>aiInput(form));assert.throws(()=>aiConfiguration({}));
});
test('AI request has bounded output, disabled storage, fixed provider and no copywriter report leakage',async()=>{
 let calls=0;
 const mock=(async(url,options)=>{calls++;assert.equal(url,'https://api.openai.com/v1/responses');assert.equal(options?.redirect,'error');const body=JSON.parse(String(options?.body));assert.equal(body.store,false);assert.equal(body.max_output_tokens,1000);assert.equal(body.model,'gpt-4.1-mini');assert.ok(!body.input.includes('private-report'));assert.equal(body.tools,undefined);return Response.json({status:'completed',output:[{type:'message',role:'assistant',content:[{type:'output_text',text:'Draft headline'}]}]});}) as typeof fetch;
 assert.equal(await generateAi({mode:'copywriter',prompt:'Write honest product copy',language:'English'},{secret:'private-report'},env,mock),'Draft headline');assert.equal(calls,1);
});
test('AI provider failures never expose provider response bodies or incomplete output',async()=>{
 const input={mode:'copilot' as const,prompt:'Explain results',language:'English'};
 for(const status of [401,403,404,429,500])await assert.rejects(generateAi(input,{},env,(async()=>new Response('private provider details',{status})) as typeof fetch),e=>e instanceof Error&&!e.message.includes('private provider details'));
 await assert.rejects(generateAi(input,{},env,(async()=>Response.json({status:'incomplete',output:[]})) as typeof fetch),/no complete answer/);
});
test('Co-Pilot context excludes identities and preserves unknown totals',()=>{
 const report:MetaReport={query:reportQuery({},'2026-10-19'),accounts:[],entities:[],facts:[],ranges:[],jobs:[],schemaReady:true,rangeSchemaReady:true,error:null,canSync:true};
 const context=aiReportContext(report);assert.equal(context.coverage,'unavailable');assert.equal(context.metrics.spend,null);assert.equal(context.lastSync,null);assert.equal('users' in context,false);
});
