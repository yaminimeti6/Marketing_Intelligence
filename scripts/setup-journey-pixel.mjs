import {readFileSync,writeFileSync} from 'node:fs';
import {parseEnv} from 'node:util';
import {createHash} from 'node:crypto';
import pg from 'pg';
import {tenantTransaction} from '../src/lib/tenant-db.ts';
import {shopifyPixelCode} from '../src/lib/shopify-pixel.ts';
import {journeyPixelCode} from '../src/lib/journey-pixel.ts';
const env={...parseEnv(readFileSync('.env','utf8')),...process.env};
const disable=process.argv.includes('--disable');
const existing=readFileSync('.env.shopify-pixel.js','utf8');
const key=existing.match(/const writeKey = "([A-Za-z0-9_-]{43})";/)?.[1];
const pool=new pg.Pool({connectionString:env.DATABASE_URL,connectionTimeoutMillis:10000});
try{
 if(!key||!env.SHOPIFY_WORKER_USER_ID)throw Error('configuration');
 const origin=new URL(env.APP_URL||env.SHOPIFY_REDIRECT_URI).origin;
 const code=shopifyPixelCode(origin,key)+'\n'+journeyPixelCode(origin,key);
 const memberships=await pool.query("SELECT workspace_id FROM memberships WHERE user_id=$1 AND role IN('owner','admin')",[env.SHOPIFY_WORKER_USER_ID]);let enabled=0;
 for(const m of memberships.rows)await tenantTransaction(pool,env.SHOPIFY_WORKER_USER_ID,m.workspace_id,async c=>{const result=await c.query('UPDATE shopify_pixel_sources SET measurement_enabled=$2 WHERE key_hash=$1 AND enabled RETURNING id',[createHash('sha256').update(key).digest('hex'),!disable]);enabled+=result.rowCount;if(result.rowCount)await c.query("INSERT INTO audit_events(workspace_id,actor_id,action) VALUES($1,$2,$3)",[m.workspace_id,env.SHOPIFY_WORKER_USER_ID,disable?'measurement.disabled':'measurement.enabled']);});
 if(enabled!==1)throw Error('source');if(disable){console.log('Pseudonymous measurement disabled. Existing aggregate pixel source unchanged.');}else{writeFileSync('.env.shopify-measurement.js',code,{mode:0o600});console.log('Measurement source enabled. Combined aggregate + measurement pixel saved privately to .env.shopify-measurement.js. Install it manually in Shopify; no installation or events claimed.');}
}catch{console.error('Measurement pixel setup failed; private values withheld.');process.exitCode=1;}finally{await pool.end();}
