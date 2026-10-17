import {verifiedMer} from '@/lib/shopify-sales-report';
import 'server-only';
import type {Session} from './auth';
import {loadMetaReport} from './meta-report';
import {loadShopifyReport} from './shopify-report';
import {combinedOverview} from '@/lib/combined-overview';
import {overviewInsights} from '@/lib/overview-insights';
import {loadAnalytics} from './analytics';
import {analyticsView} from '@/lib/analytics';
export async function loadCombinedOverview(session:Session|null,query:Record<string,string|undefined>){
 const meta=await loadMetaReport(session,{start:query.start,end:query.end,scope:query.scope,account:query.account,compare:query.compare});
 const shopify=await loadShopifyReport(session,{from:meta.query.start,to:meta.query.end});
 const result=combinedOverview(meta,shopify,query.store);result.group=query.group==='week'||query.group==='month'?query.group:'day';result.trend=overviewInsights(meta,shopify,result.storeId,result.group);
 if(meta.query.compare){const priorShopify=await loadShopifyReport(session,{from:meta.query.priorStart,to:meta.query.priorEnd});const previous=combinedOverview({...meta,query:{...meta.query,start:meta.query.priorStart,end:meta.query.priorEnd}},priorShopify,result.storeId);result.previous={metaSpend:previous.meta.spend,shopifyMerchandise:previous.shopify.merchandise,start:meta.query.priorStart,end:meta.query.priorEnd};}
 const analytics=await loadAnalytics(session,{start:result.start,end:result.end,scope:result.scope});
 result.channels=['meta'].map(provider=>{const v=analyticsView(analytics,{start:result.start,end:result.end,scope:result.scope,provider,account:provider==='meta'&&result.account!=='all'?'meta:'+result.account:'all'});return {provider,spend:v.totals.spend,accounts:v.accounts.length,ready:v.known};});
 const confirmed=(process.env.MER_CHANNELS??'').split(',').map(s=>s.trim()).filter(Boolean);
 const selectedKeys=new Set(analytics.accounts.filter(a=>confirmed.includes(a.provider)&&a.currency===result.shopify.currency&&a.timezone===result.shopify.timezone).map(a=>a.key));
 const fresh=selectedKeys.size>0&&analytics.accounts.filter(a=>selectedKeys.has(a.key)).every(a=>a.status==='connected'&&!!a.lastSync&&Date.now()-Date.parse(a.lastSync)<=15*60000&&Date.parse(a.lastSync)<=Date.now()+60000);
 result.mer=verifiedMer(result.shopify.netSales,result.channels,confirmed,result.account==='all',result.compatible&&fresh&&!result.storeError&&!result.dateError);
 result.ratioReason=!confirmed.length?'MER needs confirmation of all paid marketing channels before it can be enabled.':result.mer===null?'MER unavailable: verify sales dates, full account selection, fresh imports and complete spend for every confirmed marketing channel.':'Shopify Net Sales divided by spend from all confirmed paid marketing channels, for matching dates, currency and timezone.';
 return result;
}
