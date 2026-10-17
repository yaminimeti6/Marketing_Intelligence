import {dateFilter,localDay} from './shopify-products.ts';
import {units} from './shopify-report.ts';
import {signedDecimal} from './shopify-reconciliation.ts';
export const salesReportQuery=`query NorthstarSalesReport($query:String!) { shopifyqlQuery(query:$query) { tableData { columns { name dataType } rows } parseErrors } }`;
export type SalesReport={status:string;from:string;to:string;currency:string;timezone:string;checkedAt:string;rows:{day:string;netSales:string}[]};
export function salesWindow(timezone:string,now=new Date()){
 const today=localDay(now.toISOString(),timezone)!;
 const end=new Date(today+'T00:00:00Z');end.setUTCDate(end.getUTCDate()-1);const to=end.toISOString().slice(0,10);end.setUTCDate(end.getUTCDate()-29);
 return {from:end.toISOString().slice(0,10),to};
}
export function salesStatement(from:string,to:string){
 if(!dateFilter(from)||!dateFilter(to)||from>to||Date.parse(to)-Date.parse(from)>90*86400000)throw new Error('sales_range');
 return `FROM sales SHOW net_sales TIMESERIES day SINCE ${from} UNTIL ${to} ORDER BY day ASC LIMIT 1000`;
}
export function parseSalesReport(value:unknown,range:{from:string;to:string},currency:string,timezone:string):SalesReport{
 salesStatement(range.from,range.to);
 const data=value as {shopifyqlQuery?:{parseErrors?:unknown;tableData?:{columns?:{name:string;dataType:string}[];rows?:unknown[]}}};const result=data?.shopifyqlQuery;
 if(!result||!Array.isArray(result.parseErrors)||result.parseErrors.length||!Array.isArray(result.tableData?.columns)||!Array.isArray(result.tableData.rows))throw new Error('sales_response');
 if(!result.tableData.columns.some(c=>c.name==='day')||!result.tableData.columns.some(c=>c.name==='net_sales'&&c.dataType==='MONEY'))throw new Error('sales_columns');
 const seen=new Set<string>(),rows:SalesReport['rows']=[];
 for(const value of result.tableData.rows){const row=value as {day?:unknown;net_sales?:unknown};const day=dateFilter(row?.day);const money=row?.net_sales;
  if(!day||day<range.from||day>range.to||seen.has(day)||typeof money!=='string'||!/^[-]?\d{1,24}(\.\d{1,6})?$/.test(money))throw new Error('sales_row');
  seen.add(day);rows.push({day,netSales:money});
 }
 // TIMESERIES coverage is required, including zero days; never invent absent rows.
 const days=(Date.parse(range.to)-Date.parse(range.from))/86400000+1;
 if(rows.length!==days)throw new Error('sales_coverage');
 return {status:'succeeded',...range,currency,timezone,checkedAt:new Date().toISOString(),rows:rows.sort((a,b)=>a.day.localeCompare(b.day))};
}
export function netSalesForRange(report:SalesReport|undefined,from:string,to:string,currency:string,timezone:string,now=Date.now()){
 if(!report||report.status!=='succeeded'||report.currency!==currency||report.timezone!==timezone||!dateFilter(from)||!dateFilter(to)||from>to||from<report.from||to>report.to||!Number.isFinite(Date.parse(report.checkedAt))||now-Date.parse(report.checkedAt)>15*60000||Date.parse(report.checkedAt)>now+60000)return null;
 const selected=report.rows.filter(r=>r.day>=from&&r.day<=to);if(selected.length!==(Date.parse(to)-Date.parse(from))/86400000+1)return null;
 let sum=0n;for(const row of selected){const negative=row.netSales.startsWith('-'),amount=units(negative?row.netSales.slice(1):row.netSales);if(amount===null)return null;sum+=negative?-amount:amount;}
 return signedDecimal(sum);
}
export function verifiedMer(netSales:string|null,channels:{provider:string;spend:string|null;ready:boolean;accounts:number}[],confirmedChannels:string[],allAccounts:boolean,compatible:boolean):number|null{
 if(netSales===null||!allAccounts||!compatible||!confirmedChannels.length||new Set(confirmedChannels).size!==confirmedChannels.length||confirmedChannels.some(p=>!['meta'].includes(p)))return null;
 const negative=netSales.startsWith('-'),revenue=units(negative?netSales.slice(1):netSales);if(revenue===null)return null;
 let spend=0n;for(const provider of confirmedChannels){const row=channels.find(c=>c.provider===provider);if(!row?.ready||row.accounts<1||row.spend===null)return null;const value=units(row.spend);if(value===null)return null;spend+=value;}
 // A positive spend in an undeclared channel invalidates the coverage declaration.
 if(channels.some(c=>!confirmedChannels.includes(c.provider)&&c.spend!==null&&units(c.spend)!==0n))return null;
 if(spend<=0n)return null;
 const value=Number(revenue*1000000n/spend)/1000000;return Number.isFinite(value)?(negative?-value:value):null;
}
