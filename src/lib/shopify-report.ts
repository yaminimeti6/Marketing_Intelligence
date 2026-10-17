export type RecordRow={resource:string;source:Record<string,unknown>};
export type ShopifySummary={currency:string;orders:number;subtotal:string|null;refunded:string|null}[];
// Six decimal places retain source precision without floating point rounding.
export function units(value:unknown):bigint|null{
 if(typeof value!=='string'||!/^\d+(\.\d{1,6})?$/.test(value))return null;
 const [whole,fraction='']=value.split('.');return BigInt(whole)*1000000n+BigInt(fraction.padEnd(6,'0'));
}
export function decimal(value:bigint){return `${value/1000000n}.${(value%1000000n).toString().padStart(6,'0')}`;}
export function money(row:Record<string,unknown>,field:string,currency:string){
 const bag=row[field] as {shopMoney?:{amount?:unknown;currencyCode?:unknown}}|undefined;
 return bag?.shopMoney?.currencyCode===currency?units(bag.shopMoney.amount):null;
}
export function summarizeShopify(rows:RecordRow[]):{groups:ShopifySummary;products:number;excluded:number}{
 const groups=new Map<string,{orders:number;subtotal:bigint;refunded:bigint;subtotalValid:boolean;refundValid:boolean}>();
 let products=0,excluded=0;
 for(const {resource,source:row} of rows){
  if(resource==='products'){products++;continue;}
  if(resource!=='orders')continue;
  if(row.test!==false||row.cancelledAt!==null){excluded++;continue;}
  const currency=row.currencyCode;if(typeof currency!=='string'||! /^[A-Z]{3}$/.test(currency)){excluded++;continue;}
  const group=groups.get(currency)??{orders:0,subtotal:0n,refunded:0n,subtotalValid:true,refundValid:true};group.orders++;
  const subtotal=money(row,'currentSubtotalPriceSet',currency),refund=money(row,'totalRefundedSet',currency);
  if(subtotal===null)group.subtotalValid=false;else group.subtotal+=subtotal;
  if(refund===null)group.refundValid=false;else group.refunded+=refund;
  groups.set(currency,group);
 }
 return {groups:[...groups].sort(([a],[b])=>a.localeCompare(b)).map(([currency,g])=>({currency,orders:g.orders,subtotal:g.subtotalValid?decimal(g.subtotal):null,refunded:g.refundValid?decimal(g.refunded):null})),products,excluded};
}
