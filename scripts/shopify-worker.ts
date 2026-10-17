import { readFileSync, existsSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { shopifyConfig } from '../src/lib/shopify-config.ts';
import { ShopifyError } from '../src/lib/shopify.ts';
import { tenantTransaction } from '../src/lib/tenant-db.ts';
import { executeShopifyJob, type ShopifyJob } from '../src/lib/shopify-sync.ts';

// One bounded pass. Schedule this command externally; never claim success without provider data.
const envFile=new URL('../.env',import.meta.url);
const env={...(existsSync(envFile)?parseEnv(readFileSync(envFile,'utf8')):{}),...process.env};
let pool:pg.Pool|undefined;
try{
  const config=shopifyConfig(env);
  const userId=env.SHOPIFY_WORKER_USER_ID;
  if(!userId||!/^[a-f0-9-]{36}$/i.test(userId)||!env.TOKEN_ENCRYPTION_KEY||!env.TOKEN_ENCRYPTION_KEY_ID)throw new ShopifyError('configuration');
  pool=new pg.Pool({connectionString:env.DATABASE_URL,max:2,connectionTimeoutMillis:5000});
  const memberships=await pool.query("SELECT workspace_id FROM memberships WHERE user_id=$1 AND role IN('owner','admin')",[userId]);
  let processed=0;
  for(const {workspace_id:workspaceId} of memberships.rows){
    const transaction=<T>(operation:Parameters<typeof tenantTransaction<T>>[3])=>tenantTransaction(pool!,userId,workspaceId,operation);
    const job=await transaction(async c=>{
      const lease=randomUUID();
      await c.query("UPDATE sync_jobs SET status=CASE WHEN attempts>=5 THEN 'dead' ELSE 'queued' END,lease_token=NULL,locked_at=NULL,last_error_code='lease_expired' WHERE provider='shopify' AND status='running' AND locked_at<now()-interval '5 minutes'");
      const result=await c.query(`UPDATE sync_jobs SET status='running',attempts=attempts+1,locked_at=now(),lease_token=$1
        WHERE (workspace_id,id) IN(SELECT workspace_id,id FROM sync_jobs WHERE provider='shopify' AND status='queued' AND available_at<=now()
        ORDER BY available_at FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *`,[lease]);
      return result.rows[0] as ShopifyJob|undefined;
    });
    if(!job)continue;
    try{
      await executeShopifyJob(job,transaction,config,env.TOKEN_ENCRYPTION_KEY,env.TOKEN_ENCRYPTION_KEY_ID);processed++;
      console.log('Shopify job completed with real provider responses.');
    }catch(error){
      const kind=error instanceof ShopifyError?error.kind:'unavailable';
      const retryable=error instanceof ShopifyError&&error.retryable&&job.attempts<5;
      await transaction(async c=>{
        const updated=await c.query(`UPDATE sync_jobs SET status=$1,last_error_code=$2,locked_at=NULL,lease_token=NULL,available_at=now()+($3 * interval '1 second'),finished_at=CASE WHEN $1='queued' THEN NULL ELSE now() END WHERE id=$4 AND lease_token=$5 RETURNING id`,[retryable?'queued':job.attempts>=5?'dead':'failed',kind,kind==='rate_limited'?Math.min(300,30*2**(job.attempts-1)):Math.min(60,5*2**(job.attempts-1)),job.id,job.lease_token]);
        if(updated.rowCount&&kind==='reauthorization_required')await c.query("UPDATE provider_connections SET status='reauthorization_required' WHERE id=$1",[job.connection_id]);
      });
      console.log(`Shopify job ${retryable?'scheduled for retry':'failed'}: ${kind}. No success claimed.`);
    }
  }
  console.log(`Worker pass complete: ${processed} completed Shopify imports. Meta jobs are handled separately.`);
}catch{console.error('Shopify worker not ready or unavailable. Check private configuration, migration and worker identity. No credentials displayed.');process.exitCode=1;}
finally{if(pool)await pool.end();}
