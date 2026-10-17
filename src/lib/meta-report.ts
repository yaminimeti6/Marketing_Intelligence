export type ReportAccount={key:string;connectionId:string;id:string;name:string;currency:string|null;timezone:string|null;lastSync:string|null;status:string};
export type ReportFact={accountKey:string;level:'campaign'|'adset'|'ad';entityId:string;start:string;end:string;source:Record<string,unknown>};
export type ReportRange={accountKey:string;level:'account'|'campaign'|'adset'|'ad';entityId:string;start:string;end:string;source:Record<string,unknown>};
export type ReportEntity={accountKey:string;id:string;level:'campaigns'|'adsets'|'ads';name:string;campaignId:string|null;adsetId:string|null;status:string|null;dailyBudget:string|null;lifetimeBudget:string|null};
export type ReportJob={accountKey:string;start:string;end:string;status:string;created:string;finished:string|null;error:string|null};
export type ReportQuery={start:string;end:string;priorStart:string;priorEnd:string;compare:boolean;account:string;scope:string;level:'campaigns'|'adsets'|'ads';parent:string;status:string;search:string;error:string|null};
export type MetaReport={asOf?:string;accounts:ReportAccount[];facts:ReportFact[];ranges:ReportRange[];entities:ReportEntity[];jobs:ReportJob[];query:ReportQuery;schemaReady:boolean;rangeSchemaReady:boolean;error:string|null;canSync:boolean};

export function validDay(value:string){try{return /^\d{4}-\d{2}-\d{2}$/.test(value)&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;}catch{return false;}}
export function shiftDay(day:string,days:number){return new Date(new Date(day+'T00:00:00Z').getTime()+days*86400000).toISOString().slice(0,10);}
export function dayCount(start:string,end:string){return Math.round((Date.parse(end+'T00:00:00Z')-Date.parse(start+'T00:00:00Z'))/86400000)+1;}
export function reportQuery(params:Record<string,string|undefined>,today:string):ReportQuery {
  let start=params.start??shiftDay(today,-29),end=params.end??today,error:string|null=null;
  if(!validDay(start)||!validDay(end)||start>end||dayCount(start,end)>366||end>today){start=shiftDay(today,-29);end=today;error='Choose valid dates through today, up to 366 inclusive days.';}
  const count=dayCount(start,end);
  return {start,end,priorStart:shiftDay(start,-count),priorEnd:shiftDay(start,-1),compare:params.compare==='true',account:params.account??'all',scope:params.scope??'',level:params.level==='adsets'||params.level==='ads'?params.level:'campaigns',parent:params.parent??'',status:['ACTIVE','PAUSED','ARCHIVED','DELETED'].includes(params.status??'')?params.status!:'all',search:(params.q??'').slice(0,120),error};
}
export function accountScope(a:ReportAccount){return `${a.currency??'Unknown currency'}|${a.timezone??'Unknown timezone'}`;}
export function selectReportAccounts(accounts:ReportAccount[],query:ReportQuery){
  const scope=query.scope|| (accounts[0]?accountScope(accounts[0]):'');
  return accounts.filter(a=>accountScope(a)===scope&&(query.account==='all'||a.key===query.account));
}

// Monetary additions use integer fixed-point arithmetic; decimals remain strings in DTOs.
function decimal(value:unknown):{units:bigint;scale:number}|null {
  if(typeof value!=='string'||!/^\d+(?:\.\d{1,12})?$/.test(value))return null;
  const [whole,fraction='']=value.split('.');return {units:BigInt(whole+fraction),scale:fraction.length};
}
export function sumDecimal(values:string[]):string {
  const parsed=values.map(decimal);if(parsed.some(v=>!v))throw new Error('Invalid metric');
  const scale=Math.max(0,...parsed.map(v=>v!.scale));
  const total=parsed.reduce((sum,v)=>sum+v!.units*10n**BigInt(scale-v!.scale),0n).toString().padStart(scale+1,'0');
  return scale?`${total.slice(0,-scale)}.${total.slice(-scale)}`:total;
}
export function metricNumber(value:string|null){if(value===null)return null;const number=Number(value);return Number.isFinite(number)?number:null;}
export function ratio(numerator:string|null,denominator:string|null,multiplier=1):number|null {
  const n=metricNumber(numerator),d=metricNumber(denominator);const value=n!==null&&d!==null&&d>0?n/d*multiplier:null;return value!==null&&Number.isFinite(value)?value:null;
}
export function formatDecimal(value:string|null,digits=0){
  if(value===null)return '—';const parsed=decimal(value);if(!parsed)return '—';
  let units=parsed.units;if(parsed.scale>digits){const divisor=10n**BigInt(parsed.scale-digits);units=(units+divisor/2n)/divisor;}else units*=10n**BigInt(digits-parsed.scale);
  const text=units.toString().padStart(digits+1,'0');const major=digits?text.slice(0,-digits):text;
  return new Intl.NumberFormat('en-US').format(BigInt(major))+(digits?'.'+text.slice(-digits):'');
}
export function formatMoney(value:string|null,currency:string|null){
  if(!currency||value===null)return '—';
  try{const fmt=new Intl.NumberFormat('en-US',{style:'currency',currency,currencyDisplay:'narrowSymbol'});const symbol=fmt.formatToParts(0).find(p=>p.type==='currency')?.value??currency;return symbol+formatDecimal(value,fmt.resolvedOptions().maximumFractionDigits??2);}catch{return '—';}
}
export function budgetAmount(minor:string|null,currency:string|null){
  if(!minor||!/^\d+$/.test(minor)||!currency)return null;
  try{const digits=new Intl.NumberFormat('en-US',{style:'currency',currency}).resolvedOptions().maximumFractionDigits??2;const value=minor.padStart(digits+1,'0');return digits?value.slice(0,-digits)+'.'+value.slice(-digits):value;}catch{return null;}
}
const purchaseAliases=['omni_purchase','purchase','offsite_conversion.fb_pixel_purchase'];
function purchaseValue(value:unknown){
  if(value===undefined)return '0';if(!Array.isArray(value))return null;
  for(const alias of purchaseAliases){const rows=value.filter(v=>v&&v.action_type===alias);if(rows.length)return rows.every(v=>decimal(v.value))?sumDecimal(rows.map(v=>v.value)):null;}
  return '0';
}
export type Metrics={spend:string|null;impressions:string|null;clicks:string|null;purchases:string|null;revenue:string|null;reach:string|null;ctr:number|null;cpc:number|null;cpm:number|null;cpa:number|null;roas:number|null};
export function aggregateMetrics(facts:ReportFact[],known:boolean,reach:string|null=null):Metrics {
  const sumField=(field:string)=>!known?null:facts.every(f=>decimal(f.source[field]))?sumDecimal(facts.map(f=>String(f.source[field]))):null;
  const actions=(field:string)=>{if(!known)return null;const values=facts.map(f=>purchaseValue(f.source[field]));return values.every(v=>v!==null)?sumDecimal(values as string[]):null;};
  const spend=sumField('spend'),impressions=sumField('impressions'),clicks=sumField('clicks'),purchases=actions('actions'),revenue=actions('action_values');
  return {spend,impressions,clicks,purchases,revenue,reach:known?reach:null,ctr:ratio(clicks,impressions,100),cpc:ratio(spend,clicks),cpm:ratio(spend,impressions,1000),cpa:ratio(spend,purchases),roas:ratio(revenue,spend)};
}
export function rangeCovered(jobs:ReportJob[],accountKey:string,start:string,end:string){
  const successful=jobs.filter(j=>j.accountKey===accountKey&&j.status==='succeeded'&&validDay(j.start)&&validDay(j.end)).sort((a,b)=>a.start.localeCompare(b.start));
  let next=start;
  for(const job of successful){if(job.end<next)continue;if(job.start>next)break;next=shiftDay(job.end,1);if(next>end)return true;}
  return false;
}
export function reportCoverage(jobs:ReportJob[],accounts:ReportAccount[],start:string,end:string){
  if(!accounts.length)return false;
  return accounts.every(a=>{
    if(!a.currency||!a.timezone||!rangeCovered(jobs,a.key,start,end))return false;
    const latest=jobs.filter(j=>j.accountKey===a.key&&j.start<=end&&j.end>=start).sort((x,y)=>y.created.localeCompare(x.created))[0];
    return !latest||latest.status==='succeeded';
  });
}
export function uniqueReach(ranges:ReportRange[],accounts:ReportAccount[],start:string,end:string,level:ReportRange['level']='account',entityId?:string){
  // Neither daily reach nor reach from different ad accounts is additive.
  if(accounts.length!==1)return null;
  const row=ranges.find(r=>r.accountKey===accounts[0].key&&r.level===level&&r.start===start&&r.end===end&&(!entityId||r.entityId===entityId));
  return row&&decimal(row.source.reach)?String(row.source.reach):null;
}
export function periodFacts(facts:ReportFact[],keys:Set<string>,start:string,end:string,level:ReportFact['level']='campaign'){
  return facts.filter(f=>keys.has(f.accountKey)&&f.level===level&&f.start>=start&&f.end<=end);
}
export function changePercent(current:string|number|null,previous:string|number|null){
  if(current===null||previous===null)return null;const now=Number(current),before=Number(previous);return Number.isFinite(now)&&Number.isFinite(before)&&before>0?(now-before)/before*100:null;
}

// Shared by the visible table and server export: pagination never changes the filtered dataset.
export function metaTableRows(report:MetaReport,sort='spend'){
  const q=report.query,selected=selectReportAccounts(report.accounts,q),keys=new Set(selected.map(a=>a.key));
  const known=!report.error&&!q.error&&reportCoverage(report.jobs,selected,q.start,q.end);
  const level=q.level==='campaigns'?'campaign':q.level==='adsets'?'adset':'ad';
  return report.entities.filter(e=>keys.has(e.accountKey)&&e.level===q.level&&(!q.parent||(q.level==='adsets'?e.campaignId===q.parent:e.adsetId===q.parent))&&(q.status==='all'||e.status===q.status)&&(!q.search||`${e.name} ${e.id}`.toLowerCase().includes(q.search.toLowerCase()))).map(entity=>{
    const account=selected.find(a=>a.key===entity.accountKey)!;
    const facts=periodFacts(report.facts,new Set([entity.accountKey]),q.start,q.end,level).filter(f=>f.entityId===entity.id);
    return {entity,account,metrics:aggregateMetrics(facts,known,uniqueReach(report.ranges,[account],q.start,q.end,level,entity.id))};
  }).sort((a,b)=>sort==='name'?a.entity.name.localeCompare(b.entity.name):(Number(b.metrics[(sort==='purchases'||sort==='roas'?sort:'spend')]??-1)-Number(a.metrics[(sort==='purchases'||sort==='roas'?sort:'spend')]??-1))||a.entity.name.localeCompare(b.entity.name));
}

export function metaQueryValues(q:ReportQuery){return {start:q.start,end:q.end,account:q.account,scope:q.scope,compare:String(q.compare),level:q.level,parent:q.parent,status:q.status,q:q.search};}
