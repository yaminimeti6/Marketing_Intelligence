import fs from 'node:fs';
import {parseEnv} from 'node:util';
import {randomBytes,createHash} from 'node:crypto';
import pg from 'pg';
import {tenantTransaction} from '../src/lib/tenant-db.ts';
import {shopifyPixelCode} from '../src/lib/shopify-pixel.ts';
const e={...parseEnv(fs.readFileSync('.env','utf8')),...process.env};
const pool=new pg.Pool({connectionString:e.DATABASE_URL,connectionTimeoutMillis:5000});
try{
 const user=e.SHOPIFY_WORKER_USER_ID;if(!user)throw new Error('configuration');
 const origin=new URL(e.SHOPIFY_REDIRECT_URI!).origin,key=randomBytes(32).toString('base64url');
 const code=shopifyPixelCode(origin,key);
 const memberships=await pool.query("SELECT workspace_id FROM memberships WHERE user_id=$1 AND role IN('owner','admin')",[user]);
 const targets:{workspace:string;connection:string}[]=[];
 for(const {workspace_id:workspace} of memberships.rows)await tenantTransaction(pool,user,workspace,async c=>{
  const stores=await c.query("SELECT s.connection_id FROM shopify_stores s JOIN provider_connections p ON p.id=s.connection_id AND p.workspace_id=s.workspace_id WHERE s.shop_domain=$1 AND p.status='connected'",[e.SHOPIFY_SHOP_DOMAIN]);
  for(const row of stores.rows)targets.push({workspace,connection:row.connection_id});
 });
 if(targets.length!==1)throw new Error('configuration');
 const target=targets[0];
 await tenantTransaction(pool,user,target.workspace,async c=>{
  await c.query(`INSERT INTO shopify_pixel_sources(workspace_id,connection_id,key_hash,created_by) VALUES($1,$2,$3,$4) ON CONFLICT(workspace_id,connection_id) DO UPDATE SET key_hash=$3,created_by=$4,enabled=true,rotated_at=now()`,[target.workspace,target.connection,createHash('sha256').update(key).digest('hex'),user]);
 });
 fs.writeFileSync('.env.shopify-pixel.js',code,{mode:0o600});
 console.log('Pixel receiver configured. Open .env.shopify-pixel.js locally for the custom pixel code. No events or installation claimed.');
}catch{console.error('Pixel setup unavailable. Check migration, connected store and authorized worker identity. No credentials displayed.');process.exitCode=1;}finally{await pool.end();}
