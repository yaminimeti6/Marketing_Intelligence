import {analyticsColumns,analyticsView,type AnalyticsColumn,type AnalyticsData} from './analytics.ts';
import {shiftDay} from './meta-report.ts';

export type RuleCondition={metric:AnalyticsColumn;operator:'gt'|'gte'|'lt'|'lte';threshold:string};
export type RuleDefinition={name:string;provider:'meta'|'all';scope:string;account:string;days:number;logic:'all'|'any';conditions:RuleCondition[];cooldownHours:number};
export type RuleResult={status:'matched'|'not_matched'|'unavailable';reason:string;start:string;end:string;values:Partial<Record<AnalyticsColumn,string|number|null>>};
export function ruleDefinition(value:unknown):RuleDefinition{
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('rule_input');const r=value as RuleDefinition;
 if(typeof r.name!=='string'||!r.name.trim()||r.name.trim().length>80||/[\x00-\x1f\x7f]/.test(r.name)||!['meta','all'].includes(r.provider)||typeof r.scope!=='string'||! /^[A-Z]{3}\|[^|]{1,100}$/.test(r.scope)||typeof r.account!=='string'||(r.account!=='all'&&! /^(meta):[a-f0-9-]{36}:\d+$/.test(r.account)))throw new Error('rule_input');
 try{new Intl.DateTimeFormat('en',{timeZone:r.scope.split('|')[1]});}catch{throw new Error('rule_input');}
 if(r.account!=='all'&&r.provider!=='all'&&!r.account.startsWith(r.provider+':'))throw new Error('rule_input');
 if(![1,7,14,28].includes(r.days)||!['all','any'].includes(r.logic)||!Number.isInteger(r.cooldownHours)||r.cooldownHours<1||r.cooldownHours>168||!Array.isArray(r.conditions)||r.conditions.length<1||r.conditions.length>5)throw new Error('rule_input');
 const conditions=r.conditions.map(c=>{if(!c||!Object.hasOwn(analyticsColumns,c.metric)||!['gt','gte','lt','lte'].includes(c.operator)||typeof c.threshold!=='string'||! /^\d{1,24}(?:\.\d{1,6})?$/.test(c.threshold))throw new Error('rule_input');return {metric:c.metric,operator:c.operator,threshold:c.threshold};});
 return {name:r.name.trim(),provider:r.provider,scope:r.scope,account:r.account,days:r.days,logic:r.logic,conditions,cooldownHours:r.cooldownHours};
}
function compare(value:string|number,threshold:string){
 if(typeof value==='number')return value<Number(threshold)?-1:value>Number(threshold)?1:0;
 if(!/^\d+(?:\.\d+)?$/.test(value))throw new Error('invalid_metric');
 const [aw,af='']=value.split('.'),[bw,bf='']=threshold.split('.'),scale=Math.max(af.length,bf.length),a=BigInt(aw+af.padEnd(scale,'0')),b=BigInt(bw+bf.padEnd(scale,'0'));return a<b?-1:a>b?1:0;
}
export function evaluateRule(definition:RuleDefinition,data:AnalyticsData,now=new Date()):RuleResult{
 const r=ruleDefinition(definition),timezone=r.scope.split('|')[1],today=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(now),start=shiftDay(today,-r.days),end=shiftDay(today,-1);
 const view=analyticsView({...data,today},{start,end,scope:r.scope,account:r.account,provider:r.provider}),values=Object.fromEntries(r.conditions.map(c=>[c.metric,view.totals[c.metric]]));
 const result=(status:RuleResult['status'],reason:string):RuleResult=>({status,reason,start,end,values});
 if(view.error||data.errors.length||!view.known)return result('unavailable','Completed import coverage is required for every selected account.');
 if(view.accounts.some(a=>!a.lastSync||!Number.isFinite(Date.parse(a.lastSync))||now.getTime()-Date.parse(a.lastSync)>15*60000||Date.parse(a.lastSync)>now.getTime()+5*60000))return result('unavailable','Every selected account needs a successful import within the last 15 minutes.');
 if(r.conditions.some(c=>view.totals[c.metric]===null||typeof view.totals[c.metric]==='number'&&!Number.isFinite(view.totals[c.metric])))return result('unavailable','A condition metric is unavailable; no zero has been substituted.');
 const matches=r.conditions.map(c=>{const order=compare(view.totals[c.metric]!,c.threshold);return c.operator==='gt'?order>0:c.operator==='gte'?order>=0:c.operator==='lt'?order<0:order<=0;});
 const matched=r.logic==='all'?matches.every(Boolean):matches.some(Boolean);return result(matched?'matched':'not_matched',matched?'The selected conditions matched.':'The selected conditions did not match.');
}
