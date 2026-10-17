import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID,randomBytes } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import type { PoolClient } from 'pg';
import { executeMetaJob,type MetaJob } from '../src/lib/meta-sync.ts';
import { sealToken } from '../src/lib/security.ts';

test('Meta migration, single-use state, idempotent source sync and empty results work under tenant RLS',async()=>{
  const database=new PGlite();
  const originalFetch=globalThis.fetch;
  try{
    await database.exec('CREATE ROLE northstar_app NOSUPERUSER NOBYPASSRLS');
    for(const file of ['001_foundation.sql','002_meta_connection.sql','003_meta_range_insights.sql'])await database.exec(await readFile(new URL('../db/migrations/'+file,import.meta.url),'utf8'));
    const workspace=randomUUID(),user=randomUUID(),connection=randomUUID(),jobId=randomUUID(),lease=randomUUID();
    const key=randomBytes(32).toString('base64');
    await database.query("INSERT INTO workspaces(id,name) VALUES($1,'Test workspace')",[workspace]);
    await database.query("INSERT INTO users(id,email,name,password_hash) VALUES($1,'test@example.test','Test','unused')",[user]);
    await database.query("INSERT INTO memberships VALUES($1,$2,'owner')",[workspace,user]);
    await database.query("INSERT INTO provider_connections(workspace_id,id,provider,external_id,status) VALUES($1,$2,'meta','123','connected')",[workspace,connection]);
    await database.query('INSERT INTO encrypted_credentials(workspace_id,connection_id,envelope,key_id) VALUES($1,$2,$3,$4)',[workspace,connection,sealToken('TEST_TOKEN',`${workspace}:meta:${connection}`,key),'test-key']);
    await database.query("INSERT INTO meta_ad_accounts(workspace_id,connection_id,account_id,name,selected,currency,timezone_name) VALUES($1,$2,'42','Test fixture account',true,'USD','UTC')",[workspace,connection]);
    await database.query("INSERT INTO sync_jobs(workspace_id,id,connection_id,provider,dedupe_key,status,lease_token,attempts) VALUES($1,$2,$3,'meta','test','running',$4,1)",[workspace,jobId,connection,lease]);
    await database.exec('SET ROLE northstar_app');
    await database.query("SELECT set_config('app.user_id',$1,false),set_config('app.workspace_id',$2,false)",[user,workspace]);
    await database.query("INSERT INTO meta_oauth_states(workspace_id,state_hash,user_id,session_hash,expires_at) VALUES($1,'state-hash',$2,'session-hash',now()+interval '1 minute')",[workspace,user]);
    const consume=(hash:string)=>database.query("DELETE FROM meta_oauth_states WHERE state_hash='state-hash' AND user_id=$1 AND session_hash=$2 AND expires_at>now() RETURNING state_hash",[user,hash]);
    assert.equal((await consume('wrong-session')).rows.length,0);
    assert.equal((await consume('session-hash')).rows.length,1);
    assert.equal((await consume('session-hash')).rows.length,0);
    let emptyInsights=false;
    globalThis.fetch=async(input)=>{
      const url=new URL(String(input));
      if(url.pathname.endsWith('/debug_token'))return Response.json({data:{is_valid:true,app_id:'123',user_id:'123',scopes:['ads_read'],expires_at:Math.floor(Date.now()/1000)+3600}});
      if(url.pathname.endsWith('/insights')){
        const level=url.searchParams.get('level')!;
        return Response.json({data:emptyInsights?[]:[{account_id:'42',campaign_id:'91',adset_id:level!=='campaign'?'92':undefined,ad_id:level==='ad'?'93':undefined,date_start:'2026-10-01',date_stop:'2026-10-01',spend:'12345678901234.56',reach:'4',actions:[{action_type:'purchase',value:'1'}]}]});
      }
      const level=url.pathname.split('/').pop();
      return Response.json({data:[{id:level==='campaigns'?'91':level==='adsets'?'92':'93',name:'Explicit test fixture',campaign_id:level!=='campaigns'?'91':undefined,adset_id:level==='ads'?'92':undefined,status:'ACTIVE',daily_budget:level!=='ads'?'10000':undefined}]});
    };
    const client={query:async(sql:string,params?:unknown[])=>{const r=await database.query(sql,params);return {...r,rowCount:r.rows.length};}} as unknown as PoolClient;
    const transaction=async<T>(operation:(c:PoolClient)=>Promise<T>)=>{
      await database.exec('BEGIN');try{const result=await operation(client);await database.exec('COMMIT');return result;}catch(e){await database.exec('ROLLBACK');throw e;}
    };
    const job:MetaJob={id:jobId,workspace_id:workspace,connection_id:connection,lease_token:lease,attempts:1,payload:{accountId:'42',since:'2026-10-01',until:'2026-10-01'}};
    const config={appId:'123',appSecret:'TEST_SECRET',version:'v99.0',redirectUri:'https://example.test/api/integrations/meta/callback'};
    for(let run=0;run<2;run++){
      if(run)await database.query("UPDATE sync_jobs SET status='running' WHERE id=$1",[jobId]);
      await executeMetaJob(job,transaction,config,key,'test-key');
    }
    assert.equal((await database.query('SELECT * FROM meta_entities')).rows.length,3);
    const facts=await database.query<{source:{spend:string}}>('SELECT source FROM meta_insight_facts');
    assert.equal((await database.query('SELECT * FROM meta_range_insights')).rows.length,4);
    assert.equal(facts.rows.length,3);assert.equal(facts.rows[0].source.spend,'12345678901234.56');
    assert.deepEqual((await database.query('SELECT status FROM sync_jobs')).rows,[{status:'succeeded'}]);
    emptyInsights=true;
    await database.query("UPDATE sync_jobs SET status='running' WHERE id=$1",[jobId]);
    await executeMetaJob(job,transaction,config,key,'test-key');
    assert.equal((await database.query('SELECT * FROM meta_insight_facts')).rows.length,0);
    assert.equal((await database.query('SELECT * FROM meta_range_insights')).rows.length,0);
    await database.query("SELECT set_config('app.workspace_id',$1,false)",[randomUUID()]);
    assert.equal((await database.query('SELECT * FROM meta_ad_accounts')).rows.length,0);
    assert.equal((await database.query('SELECT * FROM meta_entities')).rows.length,0);
  }finally{globalThis.fetch=originalFetch;await database.close();}
});
