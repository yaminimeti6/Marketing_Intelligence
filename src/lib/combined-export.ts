import type {CombinedOverview} from './combined-overview.ts';
import {safeCsvCell} from './meta-export.ts';
export function combinedCsv(report:CombinedOverview){
 if(report.dateError||report.storeError||(!report.meta.accounts&&!report.storeId))throw new Error('combined_report_unavailable');
 const rows:unknown[][]=[['Record type','Source','From','To','Currency','Timezone','Period beginning','Metric','Value','Coverage','Definition']];
 const put=(source:string,currency:string|null,timezone:string|null,metric:string,value:unknown,coverage:string,definition:string,period='',kind='summary',start=report.start,end=report.end)=>rows.push([kind,source,start,end,currency,timezone,period,metric,value,coverage,definition]);
 const meta=report.meta,shop=report.shopify;
 put('Meta Ads',meta.currency,meta.timezone,'Ad spend',meta.spend,meta.ready?'complete import coverage':'incomplete','Selected Meta account reporting scope');
 put('Meta Ads',meta.currency,meta.timezone,'Attributed purchase value',meta.revenue,meta.ready?'complete import coverage':'incomplete','Meta attribution; not actual Shopify sales');
 put('Meta Ads',meta.currency,meta.timezone,'Attributed purchases',meta.purchases,meta.ready?'complete import coverage':'incomplete','Provider-attributed purchases; not unique cross-channel orders');
 put('Shopify',shop.currency,shop.timezone,'Net Sales',shop.netSales,shop.netSales===null?'unavailable':'completed sales report','Shopify sales-event dates; excludes taxes, shipping, duties and fees');
 put('Shopify',shop.currency,shop.timezone,'Retained merchandise',shop.merchandise,shop.ready?'imported subset':'unavailable',shop.coverage);
 put('Shopify',shop.currency,shop.timezone,'Net payments',shop.netPayments,shop.ready?'imported subset':'unavailable','Lifetime received minus refunded for selected order-creation cohort; not cash movements during the selected dates');
 put('Shopify',shop.currency,shop.timezone,'Recorded refunds',shop.refunded,shop.ready?'imported subset':'unavailable','Lifetime payment refunds for selected order-creation cohort');
 put('Shopify',shop.currency,shop.timezone,'Imported non-test orders',shop.orders,shop.ready?'imported subset':'unavailable',shop.coverage);
 put('Combined',null,null,'MER',report.mer,report.mer===null?'unavailable':'confirmed channel coverage',report.ratioReason);
 for(const point of report.trend){put('Meta Ads',meta.currency,meta.timezone,'Ad spend',point.metaSpend,meta.ready?'complete import coverage':'incomplete','Grouped '+report.group,point.period,'trend');put('Shopify',shop.currency,shop.timezone,'Retained merchandise',point.shopifyMerchandise,shop.ready?'imported subset':'unavailable','Grouped '+report.group+'; current retained merchandise by order creation date',point.period,'trend');}
 for(const channel of report.channels)put(channel.provider,meta.currency,meta.timezone,'Ad spend',channel.spend,channel.ready?'complete import coverage':'incomplete','Channel spend within selected currency/timezone scope','','channel');
 if(report.previous){put('Meta Ads',meta.currency,meta.timezone,'Ad spend',report.previous.metaSpend,report.previous.metaSpend===null?'incomplete':'complete import coverage','Previous equal period','','comparison',report.previous.start,report.previous.end);put('Shopify',shop.currency,shop.timezone,'Retained merchandise',report.previous.shopifyMerchandise,report.previous.shopifyMerchandise===null?'unavailable':'imported subset','Previous equal order-creation cohort','','comparison',report.previous.start,report.previous.end);}
 return {csv:'\ufeff'+rows.map(r=>r.map(safeCsvCell).join(',')).join('\r\n')+'\r\n',count:rows.length-1};
}
