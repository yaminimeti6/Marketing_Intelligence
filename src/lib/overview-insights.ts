import {aggregateMetrics,dayCount,periodFacts,selectReportAccounts,shiftDay,type MetaReport} from './meta-report.ts';
import {localDay} from './shopify-products.ts';
import {units} from './shopify-report.ts';
import {signedDecimal} from './shopify-reconciliation.ts';
import {combinedOverview} from './combined-overview.ts';
import type {ShopifyReport} from '../server/shopify-report.ts';
export function overviewInsights(meta:MetaReport,shopify:ShopifyReport,storeId:string,group='day'){
 const base=combinedOverview(meta,shopify,storeId),accounts=selectReportAccounts(meta.accounts,meta.query),keys=new Set(accounts.map(a=>a.key)),facts=periodFacts(meta.facts,keys,base.start,base.end),store=shopify.stores.find(s=>s.id===base.storeId);
 const buckets=new Map<string,string[]>();for(let i=0;i<dayCount(base.start,base.end);i++){const day=shiftDay(base.start,i),key=group==='month'?day.slice(0,7):group==='week'?shiftDay(day,-((new Date(day+'T00:00:00Z').getUTCDay()+6)%7)):day;buckets.set(key,[...(buckets.get(key)??[]),day]);}
 return [...buckets].map(([period,days])=>{
  const spend=aggregateMetrics(facts.filter(f=>days.includes(f.start)),base.meta.ready).spend;
  const orders=store?.reconciliation.orders.filter(o=>localDay(o.createdAt,store.timezone)&&days.includes(localDay(o.createdAt,store.timezone)!))??[];
  const valid=base.shopify.ready&&base.shopify.merchandise!==null&&orders.every(o=>o.currency===store?.currency&&o.values.items!==null);
  const merchandise=valid?signedDecimal(orders.reduce((sum,o)=>sum+(o.values.items!.startsWith('-')?-(units(o.values.items!.slice(1))!):units(o.values.items!)!),0n)):null;
  return {period,metaSpend:spend,shopifyMerchandise:merchandise};
 });
}
