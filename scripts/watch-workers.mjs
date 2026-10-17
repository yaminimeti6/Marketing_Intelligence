import {spawn} from 'node:child_process';
import {readFileSync,existsSync} from 'node:fs';
import {parseEnv} from 'node:util';
import {setTimeout} from 'node:timers/promises';
import pg from 'pg';
import {tenantTransaction} from '../src/lib/tenant-db.ts';
import {scheduleImports} from '../src/lib/sync-scheduler.ts';
import {metaConfig} from '../src/lib/meta.ts';
import {shopifyConfig} from '../src/lib/shopify-config.ts';

const envFile=new URL('../.env',import.meta.url),env={...(existsSync(envFile)?parseEnv(readFileSync(envFile,'utf8')):{}),...process.env};
env.RULES_WORKER_USER_ID ||= env.META_WORKER_USER_ID||env.SHOPIFY_WORKER_USER_ID;
const interval=Number(env.SYNC_INTERVAL_SECONDS||60);
if(!Number.isInteger(interval)||interval<60||interval>86400)throw new Error('SYNC_INTERVAL_SECONDS must be 60–86400.');
let stopping=false;const children=new Set();for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{stopping=true;for(const child of children)child.kill();});
const definitions=[['meta','META_WORKER_USER_ID','scripts/worker.ts',metaConfig],['shopify','SHOPIFY_WORKER_USER_ID','scripts/shopify-worker.ts',shopifyConfig],['rules','RULES_WORKER_USER_ID','scripts/rules-worker.ts',()=>{}]];
const pool=new pg.Pool({connectionString:env.DATABASE_URL,max:3,connectionTimeoutMillis:5000});
async function watch([provider,identity,script,configure]){
 try{configure(env);if(!/^[a-f0-9-]{36}$/i.test(env[identity]||''))throw new Error();}catch{console.log(`${provider}: setup pending; automatic worker skipped.`);return;}
 if(provider==='rules')console.log('rules: enabled rules checked every minute; pending imports retry after 10 seconds. In-app alerts only.');
 else console.log(`${provider}: queue checked every 5 seconds; new imports scheduled at most once per ${interval} seconds per account.`);
 while(!stopping){
  try{const memberships=await pool.query("SELECT workspace_id FROM memberships WHERE user_id=$1 AND role IN('owner','admin')",[env[identity]]);
   if(provider!=='rules')for(const row of memberships.rows)await tenantTransaction(pool,env[identity],row.workspace_id,c=>scheduleImports(c,provider,interval));
   if(stopping)break;
   await new Promise(resolve=>{const child=spawn(process.execPath,['--experimental-strip-types',script],{stdio:'inherit',windowsHide:true,env});children.add(child);child.on('error',()=>{children.delete(child);resolve();});child.on('exit',()=>{children.delete(child);resolve();});});
  }catch{console.error(`${provider}: scheduler unavailable; retrying. No successful import is claimed.`);}
  if(!stopping)await setTimeout(5000);
 }
}
try{await Promise.all(definitions.map(watch));}finally{await pool.end();}
