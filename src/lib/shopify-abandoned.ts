import {decimal,units} from './shopify-report.ts';
export type CheckoutRow={id:string;createdAt:string;updatedAt:string;completedAt:string|null;amount:string|null;currency:string|null};
export function abandonedSummary(rows:CheckoutRow[]){
 let recovered=0;const totals=new Map<string,{amount:bigint;valid:boolean}>();
 for(const row of rows){if(row.completedAt){recovered++;continue;}if(!row.currency)continue;
  const group=totals.get(row.currency)??{amount:0n,valid:true};const amount=units(row.amount);if(amount===null)group.valid=false;else group.amount+=amount;totals.set(row.currency,group);
 }
 return {unrecovered:rows.length-recovered,recovered,values:[...totals].sort(([a],[b])=>a.localeCompare(b)).map(([currency,v])=>({currency,amount:v.valid?decimal(v.amount):null}))};
}
export type AbandonedReport={status:string;checkedAt:string|null;since:string|null;until:string|null;rows:CheckoutRow[]};
