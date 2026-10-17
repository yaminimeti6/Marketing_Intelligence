import {readFileSync,existsSync} from 'node:fs';
import {parseEnv} from 'node:util';
import pg from 'pg';
import {tenantTransaction} from '../src/lib/tenant-db.ts';
import {runRule} from '../src/lib/rule-store.ts';
const file=new URL('../.env',import.meta.url),env={...(existsSync(file)?parseEnv(readFileSync(file,'utf8')):{}),...process.env};
const user=env.RULES_WORKER_USER_ID||env.META_WORKER_USER_ID||env.SHOPIFY_WORKER_USER_ID;
let pool:pg.Pool|undefined;
try{
 if(!user||!/^[a-f0-9-]{36}$/i.test(user)||!env.DATABASE_URL)throw new Error('setup');pool=new pg.Pool({connectionString:env.DATABASE_URL,max:2,connectionTimeoutMillis:5000});
 const memberships=await pool.query("SELECT workspace_id FROM memberships WHERE user_id=$1 AND role IN('owner','admin')",[user]);let evaluated=0,alerts=0;
 for(const {workspace_id:workspace} of memberships.rows){
  const ids=await tenantTransaction(pool,user,workspace,async c=>{if(!(await c.query("SELECT to_regclass('public.alert_rules') IS NOT NULL AS ready")).rows[0].ready)return [];return (await c.query("SELECT id FROM alert_rules WHERE enabled AND(last_checked_at IS NULL OR last_checked_at<now()-((CASE WHEN last_result->>'retryAfterSeconds'='10' THEN 10 ELSE 60 END)*interval '1 second')) ORDER BY last_checked_at NULLS FIRST LIMIT 50")).rows.map(r=>r.id as string);});
  for(const id of ids)try{const result=await tenantTransaction(pool,user,workspace,c=>runRule(c,id,{automatic:true}),true);if(result.outcome!=='skipped')evaluated++;if(result.outcome==='alert_created')alerts++;}catch{console.error('A rule check could not complete. Other rules remain independent; no alert is claimed for that check.');}
 }
 if(evaluated||alerts||env.RULES_WORKER_VERBOSE==='true')console.log(`Rules pass complete: ${evaluated} evaluated, ${alerts} in-app alerts created.`);
}catch{console.error('Rules worker unavailable. Check local database, migrations and Owner/Admin worker identity.');process.exitCode=1;}
finally{await pool?.end();}
