import {shiftDay} from './meta-report.ts';
import {safeCsvCell} from './meta-export.ts';
import {analyticsColumns,analyticsView,type AnalyticsData} from './analytics.ts';
export type ReportSchedule={name:string;scope:string;account:string;frequency:'daily'|'weekly'|'monthly';hour:number;days:1|7|28;recipient:string};
export function scheduleInput(value:unknown):ReportSchedule{
 if(!value||typeof value!=='object')throw Error('schedule_input');const x=value as ReportSchedule;
 if(typeof x.name!=='string'||!x.name.trim()||x.name.trim().length>80||/[\x00-\x1f\x7f]/.test(x.name)||typeof x.scope!=='string'||!/^[A-Z]{3}\|[^|]{1,100}$/.test(x.scope)||typeof x.account!=='string'||(x.account!=='all'&&!/^meta:[a-f0-9-]{36}:\d+$/.test(x.account))||!['daily','weekly','monthly'].includes(x.frequency)||!Number.isInteger(x.hour)||x.hour<0||x.hour>23||![1,7,28].includes(x.days))throw Error('schedule_input');
 if(x.recipient!==undefined&&x.recipient!==''&&(typeof x.recipient!=='string'||! /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(x.recipient)))throw Error('schedule_recipient');
 try{new Intl.DateTimeFormat('en',{timeZone:x.scope.split('|')[1]});}catch{throw Error('schedule_timezone');}
 return {name:x.name.trim(),scope:x.scope,account:x.account,frequency:x.frequency,hour:x.hour,days:x.days,recipient:x.recipient||''};
}
export function scheduleSlot(s:ReportSchedule,now=new Date(),next=false){
 const d=new Date(now);d.setUTCMinutes(0,0,0);d.setUTCHours(s.hour);
 if(s.frequency==='weekly')d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));
 if(s.frequency==='monthly')d.setUTCDate(1);
 const move=(direction:number)=>{if(s.frequency==='monthly')d.setUTCMonth(d.getUTCMonth()+direction);else d.setUTCDate(d.getUTCDate()+direction*(s.frequency==='weekly'?7:1));};
 if(d>now)move(-1);if(next)move(1);return d;
}
export function scheduledSnapshot(s:ReportSchedule,data:AnalyticsData,now=new Date()){
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:s.scope.split('|')[1],year:'numeric',month:'2-digit',day:'2-digit'}).format(now),start=shiftDay(today,-s.days),end=shiftDay(today,-1);
 const raw={start,end,scope:s.scope,account:s.account,provider:'meta',dimension:'campaign',columns:'spend,impressions,clicks,conversions,value,roas'};
 const view=analyticsView({...data,today},raw);
 const base={from:start,to:end,currency:s.scope.split('|')[0],timezone:s.scope.split('|')[1],generatedAt:now.toISOString(),lastSync:view.accounts.map(a=>({account:a.name,at:a.lastSync})),reason:'',count:0,csv:null as string|null,status:'unavailable' as 'ready'|'unavailable'};
 if(view.error||data.errors.length||!view.accounts.length||!view.known)return {...base,reason:'Complete imported coverage is required for every selected account.'};
 if(view.accounts.some(a=>!a.lastSync||!Number.isFinite(Date.parse(a.lastSync))||now.getTime()-Date.parse(a.lastSync)>900000||Date.parse(a.lastSync)>now.getTime()+60000))return {...base,reason:'Every selected account needs a successful import within the last 15 minutes.'};
 const columns=['spend','impressions','clicks','conversions','value','roas'] as const;
 const common=[start,end,base.currency,base.timezone,'complete',now.toISOString()];
 const rows=[['Record type','From','To','Currency','Reporting timezone','Coverage','Generated at UTC','Account','Last successful sync UTC','Campaign ID','Campaign name',...columns.map(k=>analyticsColumns[k])],...view.accounts.map(a=>['account metadata',...common,a.name,a.lastSync,'','',...columns.map(()=>null)]),...view.rows.map(r=>['campaign',...common,r.account.name,r.account.lastSync,r.id,r.name,...columns.map(k=>r.metrics[k])])];
 const result={count:view.rows.length,csv:'\ufeff'+rows.map(r=>r.map(safeCsvCell).join(',')).join('\r\n')+'\r\n'};
 if(new TextEncoder().encode(result.csv).byteLength>2000000)return {...base,reason:'Report exceeds the 2 MB snapshot limit. Select one account.'};
 return {...base,status:'ready' as const,count:result.count,csv:result.csv};
}
