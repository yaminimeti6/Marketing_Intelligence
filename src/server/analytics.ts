import 'server-only';
import type {Session} from './auth';
import {loadMetaReport} from './meta-report';
import {metaAnalytics,type AnalyticsData} from '@/lib/analytics';
export async function loadAnalytics(session:Session|null,raw:Record<string,string|undefined>):Promise<AnalyticsData>{
 let meta=await loadMetaReport(session,{start:raw.start,end:raw.end,compare:raw.compare});
 if(raw.scope&&meta.accounts.some(a=>`${a.currency??'Unknown'}|${a.timezone??'Unknown'}`===raw.scope))meta=await loadMetaReport(session,{start:raw.start,end:raw.end,scope:raw.scope,compare:raw.compare});
 const data=metaAnalytics(meta);data.today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());return data;
}
