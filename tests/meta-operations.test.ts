import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {randomUUID} from 'node:crypto';import {PGlite} from '@electric-sql/pglite';
import {budgetMinor,operationInput,MetaWriter,MetaWriteError,type OperationSnapshot} from '../src/lib/meta-operations.ts';
import {oauthUrl} from '../src/lib/meta.ts';
const config={appId:'123',appSecret:'private-app-secret',version:'v25.0',redirectUri:'https://example.test/api/integrations/meta/callback'};
const snapshot:OperationSnapshot={name:'Imported campaign',status:'PAUSED',dailyBudget:'10000',lifetimeBudget:null};
const fixture=(postResult:unknown={success:true},changes:Record<string,unknown>={})=>{
 const calls:{method:string;path:string;body:URLSearchParams}[]=[];
 const fetcher=(async(url,init)=>{const u=new URL(String(url)),method=String(init?.method);calls.push({method,path:u.pathname,body:new URLSearchParams(String(init?.body??''))});if(method==='GET')return Response.json(u.pathname.endsWith('act_123')?{account_id:'123',currency:'INR',account_status:1}:{id:'456',account_id:'123',status:'PAUSED',daily_budget:'10000',...changes});return Response.json(postResult);}) as typeof fetch;
 return {writer:new MetaWriter(config,'private-token',fetcher),calls};
};
test('operation input bounds batches, money, objectives and category declarations',()=>{
 assert.equal(budgetMinor('100.01','INR'),'10001');for(const amount of ['1e3','-1','0','0.001','1000000.01'])assert.throws(()=>budgetMinor(amount,'INR'));assert.throws(()=>budgetMinor('100','JPY'));
 const form=new FormData();for(const [k,v] of Object.entries({kind:'status',level:'campaigns',ids:'1,2',status:'PAUSED'}))form.set(k,v);assert.equal(operationInput(form,'INR').ids.length,2);form.set('ids','1,2,3,4,5,6');assert.throws(()=>operationInput(form,'INR'));form.set('kind','create_campaign');form.set('name','New campaign');form.set('objective','OUTCOME_TRAFFIC');assert.throws(()=>operationInput(form,'INR'));form.set('standardCategory','yes');assert.equal(operationInput(form,'INR').payload.status,'PAUSED');
});
test('campaign creation always stays PAUSED with no automatic ad sets, ads or budget',async()=>{
 const {writer,calls}=fixture({id:'789'});assert.equal(await writer.execute('123','INR','create_campaign',{name:'Draft container',objective:'OUTCOME_TRAFFIC',status:'PAUSED'},null,snapshot),'789');const write=calls.find(c=>c.method==='POST')!;assert.ok(write.path.endsWith('/act_123/campaigns'));assert.equal(write.body.get('status'),'PAUSED');assert.equal(write.body.get('special_ad_categories'),'[]');assert.equal(write.body.has('daily_budget'),false);assert.equal(write.body.has('access_token'),false);
});
test('existing mutations verify fresh ownership and snapshots, then write once',async()=>{
 const {writer,calls}=fixture();await writer.execute('123','INR','daily_budget',{level:'campaigns',budget:'20000'},'456',snapshot);assert.equal(calls.filter(c=>c.method==='POST').length,1);assert.equal(calls.at(-1)!.body.get('daily_budget'),'20000');
 for(const changed of [{account_id:'999'},{status:'ACTIVE'},{daily_budget:'12000'},{lifetime_budget:'50000'}]){const f=fixture({success:true},changed);await assert.rejects(f.writer.execute('123','INR','daily_budget',{level:'campaigns',budget:'20000'},'456',snapshot));assert.equal(f.calls.filter(c=>c.method==='POST').length,0);}
});
test('ambiguous post failures never retry or claim success',async()=>{
 let writes=0;const fetcher=(async(url,init)=>{if(init?.method==='POST'){writes++;throw Error('private provider details');}return Response.json(String(url).includes('act_123')?{account_id:'123',currency:'INR',account_status:1}:{id:'456',account_id:'123',status:'PAUSED'});}) as typeof fetch;
 await assert.rejects(new MetaWriter(config,'token',fetcher).execute('123','INR','status',{level:'campaigns',status:'ACTIVE'},'456',snapshot),e=>e instanceof MetaWriteError&&e.kind==='uncertain'&&!e.message.includes('private'));assert.equal(writes,1);
});
test('ad management OAuth is opt-in and does not change default read-only authorization',()=>{
 assert.equal(new URL(oauthUrl(config,'state')).searchParams.get('scope'),'ads_read');assert.equal(new URL(oauthUrl(config,'state',true)).searchParams.get('scope'),'ads_read,ads_management');
});
test('operation journal isolates workspace records and denies viewer mutations',async()=>{
 const db=new PGlite();try{await db.exec('CREATE ROLE northstar_app NOSUPERUSER NOBYPASSRLS');for(const m of ['001_foundation','002_meta_connection','019_meta_operations'])await db.exec(await readFile(new URL('../db/migrations/'+m+'.sql',import.meta.url),'utf8'));
 const ws=randomUUID(),other=randomUUID(),owner=randomUUID(),viewer=randomUUID(),connection=randomUUID();await db.query("INSERT INTO workspaces(id,name) VALUES($1,'Operations'),($2,'Other')",[ws,other]);await db.query("INSERT INTO users(id,email,name,password_hash) VALUES($1,'ops@example.test','Owner','unused'),($2,'ops-viewer@example.test','Viewer','unused')",[owner,viewer]);await db.query("INSERT INTO memberships(workspace_id,user_id,role) VALUES($1,$2,'owner'),($1,$3,'viewer')",[ws,owner,viewer]);await db.query("INSERT INTO provider_connections(workspace_id,id,provider,external_id,status) VALUES($1,$2,'meta','123','connected')",[ws,connection]);await db.exec('SET ROLE northstar_app');await db.query("SELECT set_config('app.workspace_id',$1,false),set_config('app.user_id',$2,false)",[ws,owner]);const operation=(await db.query<{id:string}>("INSERT INTO meta_operations(workspace_id,connection_id,account_id,currency,kind,payload,created_by) VALUES($1,$2,'123','INR','status','{}',$3) RETURNING id",[ws,connection,owner])).rows[0].id;await db.query("SELECT set_config('app.user_id',$1,false)",[viewer]);assert.equal((await db.query("UPDATE meta_operations SET status='approved' WHERE id=$1 RETURNING id",[operation])).rows.length,0);await db.query("SELECT set_config('app.workspace_id',$1,false)",[other]);assert.equal((await db.query('SELECT * FROM meta_operations')).rows.length,0);
 }finally{await db.close();}
});
