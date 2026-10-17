import {netSalesForRange} from './shopify-sales-report.ts';
import {aggregateMetrics,accountScope,periodFacts,reportCoverage,selectReportAccounts,metaTableRows,type MetaReport} from './meta-report.ts';
import type {ShopifyReport} from '../server/shopify-report.ts';
export function combinedOverview(meta:MetaReport,shopify:ShopifyReport,storeId=''){
 const accounts=selectReportAccounts(meta.accounts,meta.query),currency=accounts[0]?.currency??null,timezone=accounts[0]?.timezone??null;
 const selected=storeId?shopify.stores.find(s=>s.id===storeId):shopify.stores.find(s=>s.currency===currency&&s.timezone===timezone)??shopify.stores[0];
 const metaReady=meta.schemaReady&&!meta.error&&!meta.query.error&&accounts.every(a=>a.status==='connected')&&reportCoverage(meta.jobs,accounts,meta.query.start,meta.query.end);
 const metrics=aggregateMetrics(periodFacts(meta.facts,new Set(accounts.map(a=>a.key)),meta.query.start,meta.query.end),metaReady);
 const datesMatch=shopify.from===meta.query.start&&shopify.to===meta.query.end;
 const store=selected??null,financial=datesMatch&&shopify.available&&!!store?.ready&&!!store.reconciliation.ready;
 const group=store?.reconciliation.groups.find(g=>g.currency===store.currency);
 const foreign=store?.reconciliation.groups.some(g=>g.currency!==store.currency)??false;
 const empty=financial&&store!.reconciliation.orders.length===0;
 const shopMoney=(key:'items'|'net'|'refunded')=>!financial||foreign?null:empty?'0.000000':group?.values[key]??null;
 const compatible=!!store&&!!currency&&!!timezone&&currency===store.currency&&timezone===store.timezone;
 return {
  start:meta.query.start,end:meta.query.end,dateError:meta.query.error,
  compare:meta.query.compare,group:'day' as 'day'|'week'|'month',
  previous:null as {metaSpend:string|null;shopifyMerchandise:string|null;start:string;end:string}|null,
  trend:[] as {period:string;metaSpend:string|null;shopifyMerchandise:string|null}[],
  channels:[] as {provider:string;spend:string|null;accounts:number;ready:boolean}[],
  scopes:[...new Set(meta.accounts.map(accountScope))],scope:meta.query.scope|| (accounts[0]?accountScope(accounts[0]):''),
  accounts:meta.accounts.map(a=>({key:a.key,name:a.name,scope:accountScope(a)})),account:meta.query.account,
  stores:shopify.stores.map(s=>({id:s.id,name:s.name,currency:s.currency,timezone:s.timezone})),storeId:store?.id??'',
  storeError:storeId&&!selected?'The selected store is unavailable in this workspace.':null,
  meta:{ready:metaReady,currency,timezone,accounts:accounts.length,spend:metrics.spend,revenue:metrics.revenue,purchases:metrics.purchases,roas:metrics.roas,error:meta.error,lastSync:accounts.every(a=>a.lastSync)?accounts.reduce<string|null>((old,a)=>!old||a.lastSync!<old?a.lastSync:old,null):null},
  shopify:{netSales:store?netSalesForRange(store.salesReport,meta.query.start,meta.query.end,store.currency,store.timezone):null,available:shopify.available,ready:financial,name:store?.name??null,currency:store?.currency??null,timezone:store?.timezone??null,lastSync:store?.lastSync??null,orders:financial?store!.reconciliation.orders.length:null,merchandise:shopMoney('items'),netPayments:shopMoney('net'),refunded:shopMoney('refunded'),pending:store?.pending??false,coverage:'Imported snapshots only; complete sales-date coverage is not established.'},
  compatible,
  // Imports are updated-at snapshots, not a complete event-date sales ledger.
  // A MER denominator also needs all marketing channels, which this workspace does not yet import.
  mer:null as number|null,
  ratioReason:!compatible?'Choose the same currency and reporting timezone for both sources.':'MER is unavailable until complete Shopify sales coverage and all marketing-channel spend are established.',
  campaigns:metaReady?metaTableRows(meta).slice(0,5).map(r=>({id:r.entity.id,key:r.account.key+':'+r.entity.id,name:r.entity.name,account:r.account.name,spend:r.metrics.spend,revenue:r.metrics.revenue})):[],
 };
}
export type CombinedOverview=ReturnType<typeof combinedOverview>;
