import {decimal,money,type RecordRow} from './shopify-report.ts';
export type ProductSale={id:string;title:string;status:string;currency:string;orders:number;ordered:number|null;retained:number|null;amount:string|null};
export type ProductSales={rows:ProductSale[];detailsReady:boolean;eligibleOrders:number;ordered:number|null;retained:number|null;excluded:number;filtered:number};
export function filteredProductRows(rows:ProductSale[],search='',status='all',sort='units'){
 return rows.filter(row=>(status==='all'||row.status===status)&&row.title.toLowerCase().includes(search.trim().toLowerCase())).sort((a,b)=>sort==='name'?a.title.localeCompare(b.title)||a.id.localeCompare(b.id):(b.retained??0)-(a.retained??0)||a.title.localeCompare(b.title)||a.id.localeCompare(b.id));
}
export function dateFilter(value:unknown){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return '';
 const date=new Date(value+'T00:00:00Z');return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value?value:'';
}
export function localDay(value:unknown,timezone:string){
 if(typeof value!=='string'||!Number.isFinite(Date.parse(value)))return null;
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(value));
 return ['year','month','day'].map(type=>parts.find(p=>p.type===type)?.value).join('-');
}
export function productSales(records:RecordRow[],currency:string,timezone:string,importDetails:boolean,from='',to=''):ProductSales{
 type Acc={id:string;title:string;status:string;currency:string;orders:Set<string>;ordered:number;retained:number;amount:bigint;valid:boolean};
 const rows=new Map<string,Acc>();let eligibleOrders=0,excluded=0,filtered=0,detailsReady=importDetails;
 const put=(id:string,title:string,status:string,code:string)=>{
  const key=id+'|'+code;let row=rows.get(key);if(!row){row={id,title,status,currency:code,orders:new Set(),ordered:0,retained:0,amount:0n,valid:true};rows.set(key,row);}return row;
 };
 for(const record of records)if(record.resource==='products'&&typeof record.source.id==='string')put(record.source.id,String(record.source.title??'Untitled product'),String(record.source.status??'UNKNOWN'),currency);
 for(const {resource,source:order} of records){
  if(resource!=='orders')continue;
  if(order.test!==false||order.cancelledAt!==null){excluded++;continue;}
  const day=localDay(order.createdAt,timezone);
  if((from||to)&&(!day||(from&&day<from)||(to&&day>to))){filtered++;continue;}
  eligibleOrders++;
  const edge=order.lineItems as {nodes?:Record<string,unknown>[]} | undefined;
  if(order.lineItemsComplete!==true||!Array.isArray(edge?.nodes)){detailsReady=false;continue;}
  for(const line of edge.nodes){
   const product=line.product as {id?:string}|null,variant=line.variant as {id?:string}|null;
   const bag=line.priceAfterAllDiscountsBeforeTaxesSet as {shopMoney?:{currencyCode?:string}}|undefined;
   const code=bag?.shopMoney?.currencyCode??currency;
   if(!/^[A-Z]{3}$/.test(code)){detailsReady=false;continue;}
   const id=product?.id??variant?.id??String(line.id);
   const row=put(id,String(line.title??'Deleted or custom item'),'ORDER_ONLY',code);
   if(!Number.isSafeInteger(line.quantity)||!Number.isSafeInteger(line.currentQuantity)||Number(line.currentQuantity)<0||Number(line.quantity)<Number(line.currentQuantity)){detailsReady=false;continue;}
   row.orders.add(String(order.id));row.ordered+=Number(line.quantity);row.retained+=Number(line.currentQuantity);
   const amount=money(line,'priceAfterAllDiscountsBeforeTaxesSet',code);if(amount===null)row.valid=false;else row.amount+=amount;
  }
 }
 let ordered=0,retained=0;
 const result=[...rows.values()].map(row=>{ordered+=row.ordered;retained+=row.retained;return {id:row.id,title:row.title,status:row.status,currency:row.currency,orders:row.orders.size,ordered:detailsReady?row.ordered:null,retained:detailsReady?row.retained:null,amount:detailsReady&&row.valid?decimal(row.amount):null};});
 result.sort((a,b)=>(b.retained??0)-(a.retained??0)||a.title.localeCompare(b.title)||a.id.localeCompare(b.id));
 return {rows:result,detailsReady,eligibleOrders,ordered:detailsReady?ordered:null,retained:detailsReady?retained:null,excluded,filtered};
}
