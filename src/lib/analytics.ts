import {aggregateMetrics,dayCount,ratio,reportCoverage,reportQuery,shiftDay,sumDecimal,type MetaReport,type ReportAccount,type ReportJob} from './meta-report.ts';
import {safeCsvCell} from './meta-export.ts';

export type AnalyticsAccount=ReportAccount&{provider:'meta'};
export type AnalyticsEntity={key:string;accountKey:string;id:string;name:string;status:string;provider:'meta'};
export type AnalyticsMetric={spend:string|null;impressions:string|null;clicks:string|null;conversions:string|null;value:string|null;ctr:number|null;cpc:number|null;cpm:number|null;cpa:number|null;roas:number|null};
export type AnalyticsFact={accountKey:string;entityKey:string;day:string;spend:string|null;impressions:string|null;clicks:string|null;conversions:string|null;value:string|null};
export type AnalyticsData={accounts:AnalyticsAccount[];entities:AnalyticsEntity[];facts:AnalyticsFact[];jobs:ReportJob[];errors:string[];today:string};
export const analyticsColumns={spend:'Ad spend',impressions:'Impressions',clicks:'Clicks',conversions:'Provider conversions',value:'Attributed value',ctr:'CTR %',cpc:'CPC',cpm:'CPM',cpa:'Cost / conversion',roas:'Provider ROAS'} as const;
export type AnalyticsColumn=keyof typeof analyticsColumns;
function compareDecimal(a:string|number,b:string|number){const [aw,af='']=String(a).split('.'),[bw,bf='']=String(b).split('.'),scale=Math.max(af.length,bf.length),av=BigInt(aw+af.padEnd(scale,'0')),bv=BigInt(bw+bf.padEnd(scale,'0'));return av===bv?0:av>bv?1:-1;}
export function metaAnalytics(report:MetaReport):AnalyticsData{
 const key=(k:string)=>'meta:'+k;
 return {today:report.query.end,errors:report.error?[report.error]:[],accounts:report.accounts.map(a=>({...a,key:key(a.key),provider:'meta'})),entities:report.entities.filter(e=>e.level==='campaigns').map(e=>({key:`${key(e.accountKey)}:${e.id}`,accountKey:key(e.accountKey),id:e.id,name:e.name,status:e.status??'UNKNOWN',provider:'meta'})),jobs:report.jobs.map(j=>({...j,accountKey:key(j.accountKey)})),facts:report.facts.filter(f=>f.level==='campaign').map(f=>{
  const m=aggregateMetrics([f],true);return {accountKey:key(f.accountKey),entityKey:`${key(f.accountKey)}:${f.entityId}`,day:f.start,spend:m.spend,impressions:m.impressions,clicks:m.clicks,conversions:m.purchases,value:m.revenue};
 })};
}
export function analyticsQuery(raw:Record<string,string|undefined>,today:string){
 const date=reportQuery(raw,today),provider=raw.provider==='meta'?raw.provider:'all';
 const columns=(raw.columns??'spend,impressions,clicks,conversions,value,roas').split(',').filter((x):x is AnalyticsColumn=>Object.hasOwn(analyticsColumns,x));
 return {...date,error:date.error||(raw.provider&&!['all','meta'].includes(raw.provider)?'Selected reporting provider is unavailable.':null),provider,account:raw.account||'all',scope:raw.scope||'',dimension:raw.dimension==='account'||raw.dimension==='period'?raw.dimension:'campaign',status:['ACTIVE','PAUSED','REMOVED','ARCHIVED','DELETED'].includes(raw.status??'')?raw.status!:'all',columns:[...new Set(columns)].length?[...new Set(columns)]:['spend'] as AnalyticsColumn[],sort:Object.hasOwn(analyticsColumns,raw.sort??'')?raw.sort as AnalyticsColumn:'spend' as AnalyticsColumn,group:raw.group==='week'||raw.group==='month'?raw.group:'day',direction:raw.direction==='asc'?'asc':'desc',page:Math.max(1,Math.min(10000,Number(raw.page)||1))};
}
export function analyticsTotals(facts:AnalyticsFact[],known:boolean):AnalyticsMetric{
 const sum=(key:'spend'|'impressions'|'clicks'|'conversions'|'value')=>known&&facts.every(f=>f[key]!==null)?sumDecimal(facts.map(f=>f[key]!)):null;
 const spend=sum('spend'),impressions=sum('impressions'),clicks=sum('clicks'),conversions=sum('conversions'),value=sum('value');
 return {spend,impressions,clicks,conversions,value,ctr:ratio(clicks,impressions,100),cpc:ratio(spend,clicks),cpm:ratio(spend,impressions,1000),cpa:ratio(spend,conversions),roas:ratio(value,spend)};
}
export function analyticsView(data:AnalyticsData,raw:Record<string,string|undefined>){
 const q=analyticsQuery(raw,data.today),eligible=data.accounts.filter(a=>q.provider==='all'||a.provider===q.provider),scopes=[...new Set(eligible.map(a=>`${a.currency??'Unknown'}|${a.timezone??'Unknown'}`))];
 const scope=q.scope||scopes[0]||'',accounts=eligible.filter(a=>`${a.currency??'Unknown'}|${a.timezone??'Unknown'}`===scope&&(q.account==='all'||a.key===q.account)),keys=new Set(accounts.map(a=>a.key));
 let error=q.error||(q.scope&&!scopes.includes(q.scope)?'Selected reporting scope is unavailable.':q.account!=='all'&&!accounts.length?'Selected account is unavailable.':null);
 const connected=accounts.every(a=>a.status==='connected');
 const known=!error&&!data.errors.length&&connected&&reportCoverage(data.jobs,accounts,q.start,q.end),priorKnown=!error&&!data.errors.length&&connected&&reportCoverage(data.jobs,accounts,q.priorStart,q.priorEnd);
 const entities=data.entities.filter(e=>keys.has(e.accountKey)&&(q.status==='all'||e.status===q.status)&&(!q.search||`${e.name} ${e.id}`.toLowerCase().includes(q.search.toLowerCase()))),entityKeys=new Set(entities.map(e=>e.key));
 const filtered=data.facts.filter(f=>keys.has(f.accountKey)&&entityKeys.has(f.entityKey)),facts=filtered.filter(f=>f.day>=q.start&&f.day<=q.end),prior=filtered.filter(f=>f.day>=q.priorStart&&f.day<=q.priorEnd);
 const byEntity=new Map<string,AnalyticsFact[]>(),byAccount=new Map<string,AnalyticsFact[]>();for(const f of facts){if(!byEntity.has(f.entityKey))byEntity.set(f.entityKey,[]);byEntity.get(f.entityKey)!.push(f);if(!byAccount.has(f.accountKey))byAccount.set(f.accountKey,[]);byAccount.get(f.accountKey)!.push(f);}
 let rows=entities.map(e=>({...e,account:accounts.find(a=>a.key===e.accountKey)!,metrics:analyticsTotals(byEntity.get(e.key)??[],known)}));
 const sortRows=()=>rows.sort((a,b)=>{
  const av=a.metrics[q.sort],bv=b.metrics[q.sort];if(av===null||bv===null)return av===bv?a.key.localeCompare(b.key):av===null?1:-1;
  return (q.direction==='asc'?1:-1)*(typeof av==='string'&&typeof bv==='string'?compareDecimal(av,bv):Number(av)-Number(bv))||a.key.localeCompare(b.key);
 });
 const buckets=new Map<string,AnalyticsFact[]>();for(let i=0;i<dayCount(q.start,q.end);i++){const day=shiftDay(q.start,i),bucket=q.group==='month'?day.slice(0,7):q.group==='week'?shiftDay(day,-((new Date(day+'T00:00:00Z').getUTCDay()+6)%7)):day;buckets.set(bucket,buckets.get(bucket)??[]);}
 for(const f of facts){const bucket=q.group==='month'?f.day.slice(0,7):q.group==='week'?shiftDay(f.day,-((new Date(f.day+'T00:00:00Z').getUTCDay()+6)%7)):f.day;buckets.get(bucket)?.push(f);}
 const trend=[...buckets].map(([day,f])=>({day,...analyticsTotals(f,known)}));
 if(q.dimension==='account')rows=accounts.map(a=>({key:a.key,accountKey:a.key,id:a.id,name:a.name,status:'GROUPED',provider:a.provider,account:a,metrics:analyticsTotals(byAccount.get(a.key)??[],known)}));
 if(q.dimension==='period'){
  if(buckets.size*accounts.length>10000){error='Too many grouped rows. Select fewer accounts or a larger time grouping.';rows=[];}
  else rows=[...buckets].flatMap(([day,values])=>{const grouped=new Map<string,AnalyticsFact[]>();for(const f of values){if(!grouped.has(f.accountKey))grouped.set(f.accountKey,[]);grouped.get(f.accountKey)!.push(f);}return accounts.map(a=>({key:a.key+':'+day,accountKey:a.key,id:day,name:day,status:'GROUPED',provider:a.provider,account:a,metrics:analyticsTotals(grouped.get(a.key)??[],known)}));});
 }
 sortRows();
 return {q:{...q,scope},scopes,eligible,accounts,error,known,priorKnown,rows,totals:analyticsTotals(facts,known),previous:analyticsTotals(prior,priorKnown),trend,currency:accounts[0]?.currency??null,timezone:accounts[0]?.timezone??null};
}
export function analyticsValues(q:ReturnType<typeof analyticsQuery>){return {start:q.start,end:q.end,provider:q.provider,scope:q.scope,account:q.account,status:q.status,q:q.search,compare:String(q.compare),columns:q.columns.join(','),sort:q.sort,direction:q.direction,group:q.group,dimension:q.dimension};}
export function analyticsCsv(data:AnalyticsData,raw:Record<string,string|undefined>){
 const view=analyticsView(data,raw);if(view.error||data.errors.length||!view.accounts.length)throw new Error('Analytics unavailable');const {q}=view;
 const common=[q.start,q.end,view.currency,view.timezone,view.known?'complete':'incomplete'];
 const rows=[['Record type','Provider','Record','Record ID','Account', 'From','To','Currency','Timezone','Coverage',...q.columns.map(c=>analyticsColumns[c])],['metadata','',`${view.rows.length} filtered ${q.dimension} records`,'','',...common,...q.columns.map(()=>null)],...view.rows.map(r=>[q.dimension,r.provider,r.name,r.id,r.account.name,...common,...q.columns.map(c=>r.metrics[c])])];
 return {csv:'\ufeff'+rows.map(r=>r.map(safeCsvCell).join(',')).join('\r\n')+'\r\n',count:view.rows.length,complete:view.known,filters:analyticsValues(q)};
}
