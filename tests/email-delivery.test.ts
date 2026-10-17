import test from 'node:test';
import assert from 'node:assert/strict';
import {deliverInvitation,emailConfiguration} from '../src/lib/email-delivery.ts';
const env={RESEND_API_KEY:'re_fixture-key',EMAIL_FROM:'invites@example.com',APP_URL:'https://example.com'};
const input={id:'11111111-1111-4111-8111-111111111111',email:'member@example.com',token:'a'.repeat(43),workspace:'Example'};
test('Email configuration fails closed without credentials or a safe public origin',()=>{
 assert.equal(emailConfiguration({}),null);
 assert.equal(emailConfiguration({...env,RESEND_API_KEY:'incorrect-key'}),null);
 for(const url of ['http://example.com','https://name:password@example.com','https://example.com/path','https://example.com?x=1'])assert.equal(emailConfiguration({...env,APP_URL:url}),null);
 assert.ok(emailConfiguration(env));
});
test('Invitation delivery uses fixed HTTPS provider, idempotency and private text links',async()=>{
 let calls=0;const request:typeof fetch=async(url,options)=>{calls++;assert.equal(url,'https://api.resend.com/emails');assert.equal(options?.redirect,'error');const headers=options?.headers as Record<string,string>;assert.equal(headers['Idempotency-Key'],'invitation/'+input.id);const body=JSON.parse(String(options?.body));assert.deepEqual(body.to,[input.email]);assert.ok(body.text.includes('https://example.com/invite#'+input.token));return Response.json({id:'provider-id'});};
 assert.equal(await deliverInvitation(input,{},request),'unconfigured');assert.equal(calls,0);
 assert.equal(await deliverInvitation(input,env,request),'accepted');assert.equal(calls,1);
 assert.equal(await deliverInvitation({...input,token:'invalid'},env,request),'failed');assert.equal(calls,1);
});
test('Provider failure and uncertain network results never claim delivery',async()=>{
 assert.equal(await deliverInvitation(input,env,async()=>new Response('private error',{status:429})),'rate_limited');
 assert.equal(await deliverInvitation(input,env,async()=>{throw new Error('secret provider diagnostic');}),'network_failed');
 assert.equal(await deliverInvitation(input,env,async()=>Response.json({})),'failed');
});

test('Authentication and sender restrictions produce actionable statuses without exposing provider text',async()=>{
 assert.equal(await deliverInvitation(input,env,async()=>new Response('secret diagnostic',{status:401})),'invalid_key');
 assert.equal(await deliverInvitation(input,env,async()=>new Response('private recipient address',{status:403})),'sender_rejected');
});
