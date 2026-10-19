import {test} from 'node:test';import assert from 'node:assert/strict';import {runInNewContext} from 'node:vm';
import {experimentInput,experimentRates,experimentSnippet,type Experiment} from '../src/lib/experiments.ts';
test('experiment drafts reject same/external/recursive landing variants and unsafe paths',()=>{
 const form=new FormData();for(const [k,v] of Object.entries({name:'Landing test',kind:'landing',entry:'/pages/entry',a:'/pages/a',b:'/pages/b'}))form.set(k,v);assert.equal(experimentInput(form).kind,'landing');for(const b of ['https://external.test','//external.test','/pages/entry','/pages/a']){form.set('b',b);assert.throws(()=>experimentInput(form));}
});
test('generated headline experiment assigns after consent, keeps its arm and changes actual content before exposure',async()=>{
 const e:Experiment={id:'00000000-0000-4000-8000-000000000001',name:'Headline',kind:'headline',entry:'/pages/test',a:'Headline A',b:'Headline B',status:'running',starts:'2026-01-01T00:00:00Z',ends:'2099-01-01T00:00:00Z'};
 const storage=new Map<string,string>(),node={textContent:'Original',getClientRects:()=>[1]},sent:unknown[]=[];let allowed=false,handler=()=>{};
 const Shopify={customerPrivacy:{analyticsProcessingAllowed:()=>allowed,marketingAllowed:()=>allowed},analytics:{publish:(_n:string,v:unknown)=>{sent.push(v);return Promise.resolve();}}};
 const context={window:{Shopify},Shopify,location:{pathname:'/pages/test',search:'',assign:()=>{}},crypto:{getRandomValues:(v:Uint8Array)=>{v[0]=1;return v;}},localStorage:{getItem:(k:string)=>storage.get(k),setItem:(k:string,v:string)=>storage.set(k,v)},document:{querySelector:()=>node,addEventListener:(_n:string,cb:()=>void)=>handler=cb},Uint8Array,Date,Promise};
 const script=experimentSnippet(e).replace(/^<script>/,'').replace(/<\/script>$/,'');runInNewContext(script,context);assert.equal(sent.length,0);assert.equal(storage.size,0);allowed=true;handler();await Promise.resolve();assert.equal(node.textContent,'Headline B');assert.equal(sent.length,1);handler();assert.equal(sent.length,1);assert.equal(storage.values().next().value,'B');
});
test('Wilson intervals handle zero observations/conversions and sample-ratio checks do not assign a winner',()=>{
 assert.equal(experimentRates(0,0,0,0).a,null);const r=experimentRates(100,0,100,100);assert.equal(r.a!.low,0);assert.ok(r.b!.high<=1);assert.equal(r.imbalance,false);assert.equal(experimentRates(180,1,20,1).imbalance,true);assert.throws(()=>experimentRates(10,11,10,0));
});
