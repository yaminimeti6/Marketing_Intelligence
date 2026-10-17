import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID,randomBytes} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import type {PoolClient} from 'pg';
import {executeShopifyJob,type ShopifyJob} from '../src/lib/shopify-sync.ts';
import {sealToken} from '../src/lib/security.ts';
import {ShopifySession} from '../src/lib/shopify.ts';
test('Shopify migration, session-bound state, idempotent imports, failed-import coverage and tenant boundaries',async()=>{
 const db=new PGlite(),original=globalThis.fetch;
 try{
  await db.exec('CREATE ROLE northstar_app NOSUPERUSER NOBYPASSRLS');
  for(const f of ['001_foundation.sql','002_meta_connection.sql','003_meta_range_insights.sql','004_shopify_connection.sql','011_shopify_abandoned_checkouts.sql'])await db.exec(await readFile(new URL('../db/migrations/'+f,import.meta.url),'utf8'));
  const workspace=randomUUID(),user=randomUUID(),connection=randomUUID(),id=randomUUID(),lease=randomUUID(),key=randomBytes(32).toString('base64');
  await db.query("INSERT INTO workspaces(id,name) VALUES($1,'Test')",[workspace]);await db.query("INSERT INTO users(id,email,name,password_hash) VALUES($1,'test@shopify.test','Test','unused')",[user]);await db.query("INSERT INTO memberships VALUES($1,$2,'owner')",[workspace,user]);
  await db.query("INSERT INTO provider_connections(workspace_id,id,provider,external_id,status) VALUES($1,$2,'shopify','example.myshopify.com','connected')",[workspace,connection]);
  await db.query("INSERT INTO shopify_stores(workspace_id,connection_id,shop_domain,name,currency,timezone_name) VALUES($1,$2,'example.myshopify.com','Test fixture','INR','Asia/Kolkata')",[workspace,connection]);
  const session=new ShopifySession({id:'offline_example',shop:'example.myshopify.com',state:'test',isOnline:false,accessToken:'TEST_TOKEN',refreshToken:'TEST_REFRESH',expires:new Date(Date.now()+3600000),refreshTokenExpires:new Date(Date.now()+86400000),scope:'read_orders,read_products'});
  await db.query('INSERT INTO encrypted_credentials(workspace_id,connection_id,envelope,key_id) VALUES($1,$2,$3,$4)',[workspace,connection,sealToken(JSON.stringify(session.toObject()),`${workspace}:shopify:${connection}`,key),'test-key']);
  await db.query("INSERT INTO sync_jobs(workspace_id,id,connection_id,provider,dedupe_key,status,lease_token) VALUES($1,$2,$3,'shopify','test','running',$4)",[workspace,id,connection,lease]);
  await db.exec('SET ROLE northstar_app');await db.query("SELECT set_config('app.user_id',$1,false),set_config('app.workspace_id',$2,false)",[user,workspace]);
  await db.query("INSERT INTO shopify_oauth_states VALUES($1,'hash',$2,'session','example.myshopify.com',now()+interval '1 minute')",[workspace,user]);
  const consume=(shop:string)=>db.query("DELETE FROM shopify_oauth_states WHERE state_hash='hash' AND shop_domain=$1 AND session_hash='session' AND user_id=$2 AND expires_at>now() RETURNING state_hash",[shop,user]);
  assert.equal((await consume('wrong.myshopify.com')).rows.length,0);assert.equal((await consume('example.myshopify.com')).rows.length,1);assert.equal((await consume('example.myshopify.com')).rows.length,0);
  let fail=false;let checkoutMode='open';
  globalThis.fetch=async(_input,init)=>{if(fail)return Response.json({errors:[{message:'PRIVATE',extensions:{code:'ACCESS_DENIED'}}]});const query=JSON.parse(init?.body as string).query;
   if(query.includes('NorthstarAbandonedCheckouts'))return Response.json(checkoutMode==='denied'?{errors:[{extensions:{code:'ACCESS_DENIED'}}]}:{data:{abandonedCheckouts:{nodes:checkoutMode==='empty'?[]:[{id:'gid://shopify/AbandonedCheckout/1',createdAt:'2026-10-02T00:00:00Z',updatedAt:'2026-10-03T00:00:00Z',completedAt:checkoutMode==='recovered'?'2026-10-03T00:00:00Z':null,totalPriceSet:{shopMoney:{amount:'100.50',currencyCode:'INR'}}}],pageInfo:{hasNextPage:false,endCursor:null}}}});
   if(query.includes('NorthstarSalesReport'))return Response.json({errors:[{extensions:{code:'ACCESS_DENIED'}}]});
   if(query.includes('NorthstarShop'))return Response.json({data:{shop:{name:'Test fixture',myshopifyDomain:'example.myshopify.com',currencyCode:'INR',ianaTimezone:'Asia/Kolkata'}}});
   const resource=query.includes('NorthstarOrders')?'orders':'products';return Response.json({data:{[resource]:{nodes:[{id:`gid://shopify/${resource==='orders'?'Order':'Product'}/1`,...(resource==='orders'?{totalRefundedSet:{shopMoney:{amount:'100.50',currencyCode:'INR'}},lineItems:{nodes:[],pageInfo:{hasNextPage:false,endCursor:null}}}:{title:'Test fixture'})}],pageInfo:{hasNextPage:false,endCursor:null}}}});
  };
  const client={query:async(sql:string,params?:unknown[])=>{const r=await db.query(sql,params);return {...r,rowCount:r.rows.length};}} as unknown as PoolClient;
  const transaction=async<T>(fn:(c:PoolClient)=>Promise<T>)=>{await db.exec('BEGIN');try{const r=await fn(client);await db.exec('COMMIT');return r;}catch(e){await db.exec('ROLLBACK');throw e;}};
  const job:ShopifyJob={id,workspace_id:workspace,connection_id:connection,lease_token:lease,attempts:1,payload:{since:'2026-10-01T00:00:00Z',until:'2026-10-16T00:00:00Z'}};
  const config={clientId:'TEST',clientSecret:'TEST_SECRET',shop:'example.myshopify.com',version:'2026-10',redirectUri:'https://example.test/api/integrations/shopify/callback'};
  for(let run=0;run<2;run++){await db.query("UPDATE sync_jobs SET status='running' WHERE id=$1",[id]);await executeShopifyJob(job,transaction,config,key,'test-key');}
  assert.equal((await db.query('SELECT * FROM shopify_records')).rows.length,2);assert.equal((await db.query('SELECT * FROM sync_cursors')).rows.length,3);
  assert.equal(JSON.parse((await db.query<{cursor:string}>("SELECT cursor FROM sync_cursors WHERE resource='shopify:sales-report'")).rows[0].cursor).status,'permission_denied');
  checkoutMode='recovered';await db.query("UPDATE sync_jobs SET status='running' WHERE id=$1",[id]);await executeShopifyJob(job,transaction,config,key,'test-key');assert.ok((await db.query<{completed_at:Date|null}>('SELECT completed_at FROM shopify_abandoned_checkouts')).rows[0].completed_at);
  checkoutMode='denied';await db.query("UPDATE sync_jobs SET status='running' WHERE id=$1",[id]);await executeShopifyJob(job,transaction,config,key,'test-key');assert.equal((await db.query('SELECT * FROM shopify_abandoned_checkouts')).rows.length,1);assert.equal(JSON.parse((await db.query<{cursor:string}>("SELECT cursor FROM sync_cursors WHERE resource='shopify:abandoned-import'")).rows[0].cursor).status,'permission_denied');
  checkoutMode='empty';await db.query("UPDATE sync_jobs SET status='running' WHERE id=$1",[id]);await executeShopifyJob(job,transaction,config,key,'test-key');assert.equal((await db.query('SELECT * FROM shopify_abandoned_checkouts')).rows.length,0);
  const completed=(await db.query<{last_synced_at:Date}>('SELECT last_synced_at FROM shopify_stores')).rows[0].last_synced_at.toISOString();
  fail=true;await db.query("UPDATE sync_jobs SET status='running' WHERE id=$1",[id]);await assert.rejects(()=>executeShopifyJob(job,transaction,config,key,'test-key'));assert.equal((await db.query<{last_synced_at:Date}>('SELECT last_synced_at FROM shopify_stores')).rows[0].last_synced_at.toISOString(),completed);
  await db.query("SELECT set_config('app.workspace_id',$1,false)",[randomUUID()]);for(const table of ['shopify_stores','shopify_records','shopify_abandoned_checkouts','encrypted_credentials'])assert.equal((await db.query('SELECT * FROM '+table)).rows.length,0);
  await assert.rejects(()=>db.query("INSERT INTO shopify_stores(workspace_id,connection_id,shop_domain,name,currency,timezone_name) VALUES($1,$2,'evil.myshopify.com','Denied','INR','UTC')",[workspace,connection]));
 }finally{globalThis.fetch=original;await db.close();}
});
