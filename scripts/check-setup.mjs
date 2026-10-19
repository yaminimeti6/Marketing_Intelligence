import {readFileSync} from 'node:fs';
import {parseEnv} from 'node:util';
import pg from 'pg';
import {emailConfiguration} from '../src/lib/email-delivery.ts';

// Read-only: no credential values, URLs, recipients or database errors are printed.
let env;
try{env={...parseEnv(readFileSync(new URL('../.env',import.meta.url),'utf8')),...process.env};}
catch{console.error('SETUP INCOMPLETE: private .env could not be read.');process.exit(1);}
let failures=0;
const report=(label,ok,detail)=>{console.log(`${ok?'OK':'CHECK'}: ${label}${detail?' - '+detail:''}`);};
const present=name=>!!env[name]?.trim();
const groups={Meta:['META_APP_ID','META_APP_SECRET','META_REDIRECT_URI'],Shopify:['SHOPIFY_SHOP_DOMAIN','SHOPIFY_CLIENT_ID','SHOPIFY_CLIENT_SECRET','SHOPIFY_REDIRECT_URI']};
for(const [label,names] of Object.entries(groups)){
 const missing=names.filter(name=>!present(name));report(label+' local configuration',!missing.length,missing.length?'Missing: '+missing.join(', '):'Present; live access not checked');
}
const interval=Number(env.SYNC_INTERVAL_SECONDS||60);
report('Import scheduling interval',Number.isInteger(interval)&&interval>=60&&interval<=86400,'Runner must be running; this does not inspect worker processes');
if(!Number.isInteger(interval)||interval<60||interval>86400)failures++;
const email=emailConfiguration(env);
report('Invitation and scheduled-report email configuration',!!email,email?.from==='onboarding@resend.dev'?'Testing sender only; other recipients need a verified domain':email?'Format valid; provider and DNS not checked':'See docs/email-delivery.md');
const reportsUser=env.REPORTS_WORKER_USER_ID||env.META_WORKER_USER_ID||env.SHOPIFY_WORKER_USER_ID;
report('Scheduled reports worker identity',!!reportsUser&&/^[a-f0-9-]{36}$/i.test(reportsUser),'Requires an active external runner; worker process and delivery are not inspected');
const callbacks=['META_REDIRECT_URI','SHOPIFY_REDIRECT_URI'].filter(present);
try{const origin=new URL(env.APP_URL||env.APP_ORIGIN).origin;const mismatch=callbacks.filter(name=>{try{return new URL(env[name]).origin!==origin;}catch{return true;}});report('App and OAuth callback origins',!mismatch.length,mismatch.length?'Review: '+mismatch.join(', '):'Configured origins match');if(mismatch.length)failures++;}
catch{report('App origin',false,'Set APP_URL or APP_ORIGIN to the current app origin');failures++;}

if(!present('DATABASE_URL')){report('Runtime database',false,'DATABASE_URL missing');failures++;}
else{
 const pool=new pg.Pool({connectionString:env.DATABASE_URL,connectionTimeoutMillis:5000,query_timeout:5000,max:1});
 try{
  const c=await pool.connect();
  try{
   await c.query('BEGIN READ ONLY');
   const role=(await c.query('SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user')).rows[0];
   const safe=!!role&&!role.rolsuper&&!role.rolbypassrls;report('Runtime database role',safe,safe?'No superuser or RLS bypass':'Use the restricted application database role');if(!safe)failures++;
   const files=(await import('node:fs')).readdirSync(new URL('../db/migrations/',import.meta.url)).filter(name=>/^\d+_.+\.sql$/.test(name)).map(name=>name.slice(0,-4));
   const applied=new Set((await c.query('SELECT name FROM schema_migrations')).rows.map(row=>row.name));
   const missing=files.filter(name=>!applied.has(name));report('Versioned migrations',!missing.length,missing.length?'Missing: '+missing.join(', '):`${files.length} migration files applied`);if(missing.length)failures++;
   await c.query('ROLLBACK');
  }finally{c.release();}
 }catch{report('Runtime database checks',false,'Connection or schema check failed; credentials and error details withheld');failures++;}
 finally{await pool.end();}
}
console.log('No email sent, provider contacted, migration applied or data changed. Optional unconfigured integrations do not fail core readiness.');
process.exitCode=failures?1:0;
