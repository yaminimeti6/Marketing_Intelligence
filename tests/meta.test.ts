import test from 'node:test';
import assert from 'node:assert/strict';
import { MetaClient,metaConfig,MetaError,oauthUrl,type MetaConfig } from '../src/lib/meta.ts';
const config:MetaConfig={appId:'123',appSecret:'TEST_SECRET_ONLY',version:'v99.0',redirectUri:'https://example.test/api/integrations/meta/callback'};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});

test('Meta OAuth requires explicit version and HTTPS callback; state and read-only scope included',()=>{
  assert.throws(()=>metaConfig({}));
  assert.throws(()=>metaConfig({META_APP_ID:'123',META_APP_SECRET:'secret',META_GRAPH_API_VERSION:'v99.0',META_REDIRECT_URI:'http://example.test/api/integrations/meta/callback'}));
  const url=new URL(oauthUrl(config,'unique-state'));
  assert.equal(url.searchParams.get('state'),'unique-state');
  assert.equal(url.searchParams.get('scope'),'ads_read');
  assert.ok(!url.toString().includes(config.appSecret));
  assert.equal(url.searchParams.get('response_type'),'code');
});
test('empty authorized account list is a successful real-response state, without fabricated accounts',async()=>{
  const client=new MetaClient(config,'TEST_TOKEN_ONLY',async(input,init)=>{
    const url=new URL(String(input));assert.equal(url.hostname,'graph.facebook.com');
    assert.equal(url.pathname,'/v99.0/me/adaccounts');
    assert.equal((init?.headers as Record<string,string>).Authorization,'Bearer TEST_TOKEN_ONLY');
    assert.equal(url.searchParams.has('access_token'),false);
    return json({data:[]});
  });
  const rows=[];for await(const page of client.accounts())rows.push(...page);
  assert.deepEqual(rows,[]);
});
test('pagination uses same Graph edge and cursor, never follows next URL containing token or another host',async()=>{
  const urls:string[]=[];
  const client=new MetaClient(config,'TEST_TOKEN_ONLY',async(input)=>{
    const url=new URL(String(input));urls.push(url.hostname+url.pathname);
    if(!url.searchParams.has('after'))return json({data:[{id:'act_1'}],paging:{next:'https://evil.test/?access_token=secret',cursors:{after:'cursor-two'}}});
    assert.equal(url.searchParams.get('after'),'cursor-two');return json({data:[{id:'act_2'}]});
  });
  const rows=[];for await(const page of client.accounts())rows.push(...page);
  assert.equal(rows.length,2);assert.deepEqual(urls,['graph.facebook.com/v99.0/me/adaccounts','graph.facebook.com/v99.0/me/adaccounts']);
});
test('token exchange secrets use POST body; debug token validates app, permission and expiry',async()=>{
  let exchanges=0;
  const api=new MetaClient(config,'',async(input,init)=>{
    assert.equal(new URL(String(input)).search,'');assert.equal(init?.method,'POST');
    const body=new URLSearchParams(String(init?.body));assert.equal(body.get('client_secret'),config.appSecret);
    exchanges++;return json({access_token:exchanges===1?'SHORT_TEST_TOKEN':'LONG_TEST_TOKEN'});
  });
  assert.equal(await api.exchangeCode('TEST_CODE'),'LONG_TEST_TOKEN');
  const valid=new MetaClient(config,'LONG_TEST_TOKEN',async()=>json({data:{is_valid:true,app_id:'123',user_id:'456',scopes:['ads_read'],expires_at:Math.floor(Date.now()/1000)+3600}}));
  assert.equal((await valid.validateToken()).userId,'456');
  const invalid=new MetaClient(config,'LONG_TEST_TOKEN',async()=>json({data:{is_valid:true,app_id:'999',user_id:'456',scopes:['ads_read']}}));
  await assert.rejects(invalid.validateToken(),(e:unknown)=>e instanceof MetaError&&e.kind==='reauthorization_required');
});
test('Meta errors are sanitized and classify expired permissions, throttling and transient failures',async()=>{
  for(const [code,kind,retryable] of [[190,'reauthorization_required',false],[200,'permission_denied',false],[4,'rate_limited',true],[1,'unavailable',true]] as const){
    const api=new MetaClient(config,'TEST_TOKEN_ONLY',async()=>json({error:{code,message:'PRIVATE_PROVIDER_ERROR_WITH_TOKEN',is_transient:code===1}},400));
    await assert.rejects(async()=>{for await(const page of api.accounts())void page;},(e:unknown)=>e instanceof MetaError&&e.kind===kind&&e.retryable===retryable&&!e.message.includes('PRIVATE_PROVIDER'));
  }
});
test('campaign/adset/ad Insights use explicit date range, source attribution settings and safe identifiers',async()=>{
  const api=new MetaClient(config,'TEST_TOKEN_ONLY',async(input)=>{
    const url=new URL(String(input));assert.equal(url.pathname,'/v99.0/act_42/insights');
    assert.equal(url.searchParams.get('use_account_attribution_setting'),'true');
    assert.deepEqual(JSON.parse(url.searchParams.get('time_range')!),{since:'2026-10-01',until:'2026-10-16'});
    assert.ok(['campaign','adset','ad'].includes(url.searchParams.get('level')!));return json({data:[]});
  });
  for(const level of ['campaign','adset','ad'] as const)for await(const page of api.insights('act_42',level,'2026-10-01','2026-10-16'))assert.deepEqual(page,[]);
  assert.throws(()=>api.entities('../me','campaigns'));
  assert.throws(()=>api.insights('42','ad','2026-02-30','2026-10-16'));
});
