import {test} from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {readFile} from 'node:fs/promises';
import {randomUUID,createHash} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {parsePixelEvent,shopifyPixelCode} from '../src/lib/shopify-pixel.ts';
const key='a'.repeat(43);
const payload=()=>({key,id:'event-1',name:'product_added_to_cart',productId:'gid://shopify/Product/1',quantity:2,timestamp:new Date().toISOString()});
test('Pixel payloads are minimal, bounded, deduplicated by a source-scoped hash and exclude identity fields',()=>{
 const event=parsePixelEvent(payload());assert.equal(event.keyHash.length,64);assert.equal(event.quantity,2);assert.equal(parsePixelEvent(payload()).eventHash,event.eventHash);
 for(const extra of [{email:'private@example.test'},{workspace_id:randomUUID()},{quantity:1001},{quantity:0},{timestamp:'2020-01-01'},{productId:'https://evil.test'},{key:'bad'}])assert.throws(()=>parsePixelEvent({...payload(),...extra}));
 assert.doesNotThrow(()=>parsePixelEvent({...payload(),name:'checkout_started',productId:null}));
 assert.doesNotThrow(()=>parsePixelEvent({...payload(),name:'page_viewed',productId:null}));
});
test('Generated custom pixel respects current consent and sends only documented product IDs and event fields',async()=>{
 const handlers:Record<string,(event:unknown)=>void>={},sent:Record<string,unknown>[]=[];let consent:((event:unknown)=>void)|undefined;
 const code=shopifyPixelCode('https://example.test',key);
 runInNewContext(code,{init:{customerPrivacy:{analyticsProcessingAllowed:false}},api:{customerPrivacy:{subscribe:(_name:string,callback:(e:unknown)=>void)=>{consent=callback;}}},analytics:{subscribe:(name:string,callback:(e:unknown)=>void)=>{handlers[name]=callback;}},fetch:async(_url:string,init:{body:string;credentials:string;headers:Record<string,string>})=>{assert.equal(init.credentials,'omit');sent.push(JSON.parse(init.body));}});
 const event={id:'event-1',timestamp:new Date().toISOString(),name:'product_added_to_cart',data:{cartLine:{quantity:2,merchandise:{product:{id:'123'}}},email:'never-send'}};
 handlers.product_added_to_cart(event);assert.equal(sent.length,0);
 consent!({customerPrivacy:{analyticsProcessingAllowed:true}});handlers.product_added_to_cart(event);assert.equal(sent.length,1);assert.equal(sent[0].productId,'gid://shopify/Product/123');assert.equal(Object.hasOwn(sent[0],'email'),false);
 handlers.product_viewed({...event,name:'product_viewed',data:{productVariant:{product:{id:'gid://shopify/Product/123'}}}});assert.equal(sent.length,2);
 consent!({customerPrivacy:{analyticsProcessingAllowed:false}});handlers.product_added_to_cart(event);assert.equal(sent.length,2);
 consent!({customerPrivacy:{analyticsProcessingAllowed:true}});handlers.page_viewed({...event,id:'page-event',name:'page_viewed'});assert.equal(sent.length,3);assert.equal(sent[2].productId,null);assert.equal(sent[2].name,'page_viewed');
 assert.throws(()=>shopifyPixelCode('http://example.test',key));
});
test('Public pixel capability binds events to its tenant, deduplicates, restricts raw writes and supports disable/rotation/rate limits',async()=>{
 const db=new PGlite();try{
  await db.exec('CREATE ROLE northstar_app NOSUPERUSER NOBYPASSRLS');
  for(const name of ['001_foundation.sql','002_meta_connection.sql','003_meta_range_insights.sql','004_shopify_connection.sql','008_shopify_customer_events.sql','009_shopify_pixel_context.sql','010_shopify_page_views.sql'])await db.exec(await readFile(new URL('../db/migrations/'+name,import.meta.url),'utf8'));
  const workspace=randomUUID(),other=randomUUID(),user=randomUUID(),viewer=randomUUID(),connection=randomUUID();
  await db.query("INSERT INTO workspaces(id,name) VALUES($1,'Pixel fixture'),($2,'Other')",[workspace,other]);
  await db.query("INSERT INTO users(id,email,name,password_hash) VALUES($1,'pixel@example.test','Owner','unused'),($2,'viewer@example.test','Viewer','unused')",[user,viewer]);
  await db.query("INSERT INTO memberships VALUES($1,$2,'owner'),($1,$3,'viewer')",[workspace,user,viewer]);
  await db.query("INSERT INTO provider_connections(workspace_id,id,provider,external_id,status) VALUES($1,$2,'shopify','fixture.myshopify.com','connected')",[workspace,connection]);
  await db.query("INSERT INTO shopify_stores(workspace_id,connection_id,shop_domain,name,currency,timezone_name) VALUES($1,$2,'fixture.myshopify.com','Fixture','INR','UTC')",[workspace,connection]);
  await db.exec('SET ROLE northstar_app');await db.query("SELECT set_config('app.user_id',$1,false),set_config('app.workspace_id',$2,false)",[user,workspace]);
  const event=parsePixelEvent(payload());
  const source=(await db.query<{id:string}>('INSERT INTO shopify_pixel_sources(workspace_id,connection_id,key_hash,created_by) VALUES($1,$2,$3,$4) RETURNING id',[workspace,connection,event.keyHash,user])).rows[0].id;
  const receive=async(hash=event.eventHash,keyHash=event.keyHash)=> (await db.query<{result:string}>('SELECT shopify_receive_event($1,$2,$3,$4,$5,$6) AS result',[keyHash,hash,event.name,event.productId,event.quantity,event.timestamp])).rows[0].result;
  assert.equal(await receive(),'accepted');assert.equal(await receive(),'duplicate');assert.equal(await receive(event.eventHash,'b'.repeat(64)),'unknown');
  assert.equal((await db.query('SELECT * FROM shopify_customer_events')).rows.length,1);
  await db.query("SELECT set_config('app.workspace_id',$1,false)",[other]);assert.equal((await db.query('SELECT * FROM shopify_customer_events')).rows.length,0);
  // A write capability can only write to its own bound source even without caller tenant context.
  assert.equal(await receive('c'.repeat(64)),'accepted');
  await db.exec('BEGIN');await receive('0'.repeat(64));assert.equal((await db.query<{ws:string}>("SELECT current_setting('app.workspace_id') AS ws")).rows[0].ws,other);await db.exec('COMMIT');
  await db.query("SELECT set_config('app.workspace_id',$1,false),set_config('app.user_id',$2,false)",[workspace,viewer]);
  assert.equal((await db.query('UPDATE shopify_pixel_sources SET enabled=false RETURNING id')).rows.length,0);
  await assert.rejects(()=>db.query('DELETE FROM shopify_customer_events'));
  await db.query("SELECT set_config('app.user_id',$1,false)",[user]);await db.query('UPDATE shopify_pixel_sources SET enabled=false WHERE id=$1',[source]);assert.equal(await receive('d'.repeat(64)),'unknown');
  await db.query('UPDATE shopify_pixel_sources SET enabled=true,key_hash=$1 WHERE id=$2',['e'.repeat(64),source]);assert.equal(await receive('d'.repeat(64)),'unknown');
  await db.exec('RESET ROLE');
  await db.query("INSERT INTO shopify_customer_events(source_id,workspace_id,event_hash,event_name,quantity,occurred_at) SELECT $1,$2,md5(i::text)||md5(i::text),'checkout_started',1,now() FROM generate_series(1,600)i",[source,workspace]);
  await db.exec('SET ROLE northstar_app');assert.equal(await receive('f'.repeat(64),'e'.repeat(64)),'limited');
  assert.equal((await db.query('SELECT count(*) AS count FROM shopify_customer_events')).rows[0]!==undefined,true);
 }finally{await db.close();}
});
