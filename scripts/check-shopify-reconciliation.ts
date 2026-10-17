import {netSalesForRange,type SalesReport} from '../src/lib/shopify-sales-report.ts';
import {readFileSync} from 'node:fs';
import {parseEnv} from 'node:util';
import pg from 'pg';
import {tenantTransaction} from '../src/lib/tenant-db.ts';
import {reconcileShopify} from '../src/lib/shopify-reconciliation.ts';
const env={...parseEnv(readFileSync(new URL('../.env',import.meta.url),'utf8')),...process.env};
const pool=new pg.Pool({connectionString:env.DATABASE_URL,connectionTimeoutMillis:5000,query_timeout:10000});
try{
 const identity=env.SHOPIFY_WORKER_USER_ID||env.META_WORKER_USER_ID;
 if(!identity||!(/^[a-f0-9-]{36}$/i.test(identity)))throw new Error('identity');
 const memberships=(await pool.query("SELECT workspace_id,user_id FROM memberships WHERE user_id=$1 AND role IN('owner','admin')",[identity])).rows;
 if(!memberships.length)throw new Error('membership');
 let storesChecked=0;
 for(const m of memberships)await tenantTransaction(pool,m.user_id,m.workspace_id,async c=>{
  const stores=(await c.query("SELECT s.connection_id,s.currency,s.timezone_name,p.status,p.scopes FROM shopify_stores s JOIN provider_connections p ON p.id=s.connection_id AND p.workspace_id=s.workspace_id")).rows;
  for(const store of stores){
   storesChecked++;
   const records=(await c.query('SELECT resource,source FROM shopify_records WHERE connection_id=$1',[store.connection_id])).rows;
   const checkpoint=(await c.query("SELECT cursor FROM sync_cursors WHERE connection_id=$1 AND resource='shopify:completed-import'",[store.connection_id])).rows[0];
   let cursor:{financialVersion?:number}={};try{cursor=typeof checkpoint?.cursor==='string'?JSON.parse(checkpoint.cursor):checkpoint?.cursor??{};}catch{}
   const last=(await c.query("SELECT status FROM sync_jobs WHERE connection_id=$1 AND provider='shopify' ORDER BY created_at DESC LIMIT 1",[store.connection_id])).rows[0];
   const ready=store.status==='connected'&&last?.status==='succeeded'&&cursor.financialVersion===1;
   const report=reconcileShopify(records,store.currency,store.timezone_name,ready);
   const salesRow=(await c.query("SELECT cursor FROM sync_cursors WHERE connection_id=$1 AND resource='shopify:sales-report'",[store.connection_id])).rows[0];
   let sales:SalesReport|undefined;try{sales=typeof salesRow?.cursor==='string'?JSON.parse(salesRow.cursor):salesRow?.cursor;}catch{}
   const reportAccess=Array.isArray(store.scopes)&&store.scopes.includes('read_reports');
   const reportReady=ready&&reportAccess&&!!sales&&netSalesForRange(sales,sales.from,sales.to,store.currency,store.timezone_name)!==null;
   console.log(JSON.stringify({storeNumber:storesChecked,connected:store.status==='connected',completedFinancialImport:ready,importedOrders:records.filter(r=>r.resource==='orders').length,eligibleOrders:report.orders.length,paymentMatches:report.groups.reduce((n,g)=>n+g.matched,0),paymentDifferences:report.groups.reduce((n,g)=>n+g.differences,0),incompletePayments:report.groups.reduce((n,g)=>n+g.incomplete,0),ordersWithRecordedRefunds:report.orders.filter(o=>o.values.refunded!==null&&Number(o.values.refunded)>0).length,reportAccessGranted:Array.isArray(store.scopes)&&store.scopes.includes('read_reports'),salesReportStatus:sales?.status??'not_imported',salesReportDays:sales?.rows.length??0,netSalesEnabled:reportReady,merCoverageChecked:false}));
  }
 },true);
 console.log(`${storesChecked} stores checked. Payment identity is not event-date Net Sales. Net Sales needs authoritative sales reporting; MER also needs complete matching marketing spend. No source records or store settings changed.`);
}catch{console.error('Reconciliation check unavailable. Check runtime database and an Owner/Admin worker identity. No credentials or order details displayed.');process.exitCode=1;}
finally{await pool.end();}
