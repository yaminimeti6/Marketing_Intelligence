import {units,decimal,type RecordRow} from './shopify-report.ts';
import {localDay} from './shopify-products.ts';
const sourceFields={original:'originalTotalPriceSet',current:'currentTotalPriceSet',discounts:'currentTotalDiscountsSet',tax:'currentTotalTaxSet',shipping:'currentShippingPriceSet',received:'totalReceivedSet',refunded:'totalRefundedSet',net:'netPaymentSet',outstanding:'totalOutstandingSet',shippingRefund:'totalRefundedShippingSet'} as const;
export type FinancialMetric=keyof typeof sourceFields|'grossItems'|'itemDiscounts'|'items';
type Values=Record<FinancialMetric,string|null>;
export type ReconciledOrder={id:string;createdAt:string;currency:string;cancelled:boolean;paymentStatus:string;taxesIncluded:boolean|null;values:Values;difference:string|null;status:'matched'|'difference'|'incomplete'};
export type Reconciliation={ready:boolean;orders:ReconciledOrder[];groups:{currency:string;orders:number;matched:number;differences:number;incomplete:number;values:Values}[];excluded:number;filtered:number};
export function signedDecimal(value:bigint){return value<0n?'-'+decimal(-value):decimal(value);}
function number(value:unknown){if(typeof value!=='string'||! /^-?\d{1,24}(\.\d{1,6})?$/.test(value))return null;return value.startsWith('-')?-(units(value.slice(1))!):units(value);}
function amount(row:Record<string,unknown>,field:string,currency:string){const bag=row[field] as {shopMoney?:{amount?:unknown;currencyCode?:unknown}}|undefined;return bag?.shopMoney?.currencyCode===currency?number(bag.shopMoney.amount):null;}
export function reconcileShopify(records:RecordRow[],storeCurrency:string,timezone:string,ready:boolean,from='',to=''):Reconciliation{
 const result:Reconciliation={ready,orders:[],groups:[],excluded:0,filtered:0};if(!ready)return result;
 const metrics=[...Object.keys(sourceFields),'grossItems','itemDiscounts','items'] as FinancialMetric[];
 type Acc={orders:number;matched:number;differences:number;incomplete:number;totals:Record<FinancialMetric,bigint|null>};const groups=new Map<string,Acc>();
 for(const {resource,source:row} of records){
  if(resource!=='orders')continue;if(row.test!==false){result.excluded++;continue;}
  const day=localDay(row.createdAt,timezone);if(!day){result.excluded++;continue;}if((from&&day<from)||(to&&day>to)){result.filtered++;continue;}
  const code=(row.currentTotalPriceSet as {shopMoney?:{currencyCode?:unknown}})?.shopMoney?.currencyCode;
  const currency=typeof code==='string'&&/^[A-Z]{3}$/.test(code)?code:storeCurrency;
  const raw={} as Record<FinancialMetric,bigint|null>;
  for(const metric of Object.keys(sourceFields) as (keyof typeof sourceFields)[])raw[metric]=amount(row,sourceFields[metric],currency);
  const cancelled=row.cancelledAt!==null;raw.grossItems=0n;raw.items=0n;
  const lines=(row.lineItems as {nodes?:Record<string,unknown>[]} | undefined)?.nodes;
  if(!cancelled){
   if(row.lineItemsComplete!==true||!Array.isArray(lines))raw.items=raw.grossItems=null;
   else for(const line of lines){
    if(typeof line.isGiftCard!=='boolean'||!Number.isSafeInteger(line.currentQuantity)||Number(line.currentQuantity)<0){raw.items=raw.grossItems=null;break;}
    if(line.isGiftCard)continue;
    const price=amount(line,'originalUnitPriceSet',currency),net=amount(line,'priceAfterAllDiscountsBeforeTaxesSet',currency);
    raw.grossItems=raw.grossItems===null||price===null?null:raw.grossItems+price*BigInt(Number(line.currentQuantity));
    raw.items=raw.items===null||net===null?null:raw.items+net;
   }
  }
  // Original unit prices can include tax; do not mislabel tax as an item discount.
  if(!cancelled&&row.taxesIncluded!==false)raw.grossItems=null;
  raw.itemDiscounts=raw.grossItems===null||raw.items===null?null:raw.grossItems-raw.items;
  const difference=raw.received===null||raw.refunded===null||raw.net===null?null:raw.net-(raw.received-raw.refunded);
  const status=difference===null?'incomplete':difference===0n?'matched':'difference';
  const values=Object.fromEntries(metrics.map(metric=>[metric,raw[metric]===null?null:signedDecimal(raw[metric]!)])) as Values;
  result.orders.push({id:String(row.id),createdAt:String(row.createdAt),currency,cancelled,paymentStatus:typeof row.displayFinancialStatus==='string'?row.displayFinancialStatus:'UNKNOWN',taxesIncluded:typeof row.taxesIncluded==='boolean'?row.taxesIncluded:null,values,difference:difference===null?null:signedDecimal(difference),status});
  const acc=groups.get(currency)??{orders:0,matched:0,differences:0,incomplete:0,totals:Object.fromEntries(metrics.map(metric=>[metric,0n])) as Record<FinancialMetric,bigint|null>};
  acc.orders++;if(status==='matched')acc.matched++;else if(status==='difference')acc.differences++;else acc.incomplete++;
  for(const metric of metrics)acc.totals[metric]=acc.totals[metric]===null||raw[metric]===null?null:acc.totals[metric]!+raw[metric]!;
  groups.set(currency,acc);
 }
 result.groups=[...groups].sort(([a],[b])=>a.localeCompare(b)).map(([currency,acc])=>({currency,orders:acc.orders,matched:acc.matched,differences:acc.differences,incomplete:acc.incomplete,values:Object.fromEntries(metrics.map(metric=>[metric,acc.totals[metric]===null?null:signedDecimal(acc.totals[metric]!)])) as Values}));
 result.orders.sort((a,b)=>b.createdAt.localeCompare(a.createdAt)||a.id.localeCompare(b.id));return result;
}
