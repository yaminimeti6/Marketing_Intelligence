import {createHmac} from 'node:crypto';
import type {MetaConfig} from './meta.ts';
export type OperationKind='create_campaign'|'status'|'daily_budget';
export type OperationPayload={name?:string;objective?:string;status?:'ACTIVE'|'PAUSED';budget?:string;level?:'campaigns'|'adsets'|'ads'};
export type OperationSnapshot={name:string;status:string|null;dailyBudget:string|null;lifetimeBudget:string|null};
export function budgetMinor(value:string,currency:string){
 if(!['INR','USD','EUR','GBP'].includes(currency)||!/^\d{1,7}(?:\.\d{1,2})?$/.test(value))throw Error('Daily budget requires INR/USD/EUR/GBP and at most two decimals.');
 const [major,fraction='']=value.split('.'),minor=BigInt(major)*100n+BigInt(fraction.padEnd(2,'0'));if(minor<=0n||minor>100000000n)throw Error('Budget must be positive and no more than 1,000,000 currency units per day.');return minor.toString();
}
export function operationInput(form:FormData,currency:string){
 const kind=String(form.get('kind')) as OperationKind;
 if(kind==='create_campaign'){
  const name=String(form.get('name')??'').trim(),objective=String(form.get('objective'));
  if(name.length<3||name.length>100||!['OUTCOME_TRAFFIC','OUTCOME_SALES','OUTCOME_AWARENESS'].includes(objective)||form.get('standardCategory')!=='yes')throw Error('Enter a campaign name/objective and confirm this is not a Special Ad Category campaign.');
  return {kind,payload:{name,objective,status:'PAUSED'} satisfies OperationPayload,ids:[] as string[]};
 }
 if(!['status','daily_budget'].includes(kind))throw Error('Unsupported action.');
 const level=String(form.get('level'));if(!['campaigns','adsets','ads'].includes(level))throw Error('Choose an entity level.');
 const ids=[...new Set(String(form.get('ids')??'').split(/[\s,]+/).filter(Boolean))];if(!ids.length||ids.length>5||ids.some(id=>!/^\d+$/.test(id)))throw Error('Enter 1–5 unique imported object IDs from this account.');
 if(kind==='status'){const status=String(form.get('status'));if(!['ACTIVE','PAUSED'].includes(status))throw Error('Choose ACTIVE or PAUSED.');return {kind,payload:{level,status} as OperationPayload,ids};}
 if(level==='ads')throw Error('Ads do not have their own daily budget.');
 return {kind,payload:{level,budget:budgetMinor(String(form.get('budget')??''),currency)} as OperationPayload,ids};
}
export class MetaWriteError extends Error{kind:'rejected'|'uncertain'|'changed'|'permission';constructor(kind:'rejected'|'uncertain'|'changed'|'permission'){super(kind);this.kind=kind;}}
export class MetaWriter{
 private config:MetaConfig;private token:string;private transport:typeof fetch;
 constructor(config:MetaConfig,token:string,transport:typeof fetch=fetch){this.config=config;this.token=token;this.transport=transport;}
 private async request(path:string,params:Record<string,string>,post=false){
  if(!/^(?:act_\d+(?:\/campaigns)?|\d+)$/.test(path))throw new MetaWriteError('rejected');
  const url=new URL(`https://graph.facebook.com/${this.config.version}/${path}`),body=new URLSearchParams({...params,appsecret_proof:createHmac('sha256',this.config.appSecret).update(this.token).digest('hex')});if(!post)url.search=body.toString();
  let response:Response;try{response=await this.transport(url,{method:post?'POST':'GET',redirect:'error',headers:{Authorization:'Bearer '+this.token,...(post?{'Content-Type':'application/x-www-form-urlencoded'}:{})},...(post?{body:body.toString()}:{}),signal:AbortSignal.timeout(12000),cache:'no-store'});}catch{throw new MetaWriteError(post?'uncertain':'rejected');}
  let data:Record<string,unknown>;try{data=await response.json();if(!data||typeof data!=='object'||Array.isArray(data))throw Error();}catch{throw new MetaWriteError(post?'uncertain':'rejected');}
  if(!response.ok||data.error)throw new MetaWriteError(response.status===401||response.status===403?'permission':post&&response.status>=500?'uncertain':'rejected');return data;
 }
 async execute(account:string,currency:string,kind:OperationKind,payload:OperationPayload,target:string|null,snapshot:OperationSnapshot){
  if(!/^\d+$/.test(account))throw new MetaWriteError('rejected');
  const a=await this.request('act_'+account,{fields:'account_id,currency,account_status'});if(a.account_id!==account||a.currency!==currency||a.account_status!==1)throw new MetaWriteError('changed');
  if(kind==='create_campaign'){
   if(target!==null||!payload.name||!['OUTCOME_TRAFFIC','OUTCOME_SALES','OUTCOME_AWARENESS'].includes(payload.objective??'')||payload.status!=='PAUSED')throw new MetaWriteError('rejected');
   const r=await this.request('act_'+account+'/campaigns',{name:payload.name,objective:payload.objective!,status:'PAUSED',special_ad_categories:'[]',is_adset_budget_sharing_enabled:'false'},true);if(typeof r.id!=='string'||!/^\d+$/.test(r.id))throw new MetaWriteError('uncertain');return r.id;
  }
  if(!target||!/^\d+$/.test(target)||!['campaigns','adsets','ads'].includes(payload.level??''))throw new MetaWriteError('rejected');
  const current=await this.request(target,{fields:'id,account_id,status'+(payload.level==='ads'?'':',daily_budget,lifetime_budget')});
  if(current.id!==target||current.account_id!==account||current.status!==snapshot.status)throw new MetaWriteError('changed');
  let params:Record<string,string>;
  if(kind==='status'){if(!['ACTIVE','PAUSED'].includes(payload.status??''))throw new MetaWriteError('rejected');params={status:payload.status!};}
  else if(kind==='daily_budget'){
   if(payload.level==='ads'||!['INR','USD','EUR','GBP'].includes(currency)||!/^\d+$/.test(payload.budget??'')||BigInt(payload.budget!)<=0n||BigInt(payload.budget!)>100000000n)throw new MetaWriteError('rejected');
   if(String(current.daily_budget??'')!==String(snapshot.dailyBudget??'')||String(current.lifetime_budget??'0')!==String(snapshot.lifetimeBudget??'0')||!snapshot.dailyBudget||BigInt(snapshot.dailyBudget)<=0n||BigInt(snapshot.lifetimeBudget??'0')>0n)throw new MetaWriteError('changed');params={daily_budget:payload.budget!};
  }else throw new MetaWriteError('rejected');
  const result=await this.request(target,params,true);if(result.success!==true)throw new MetaWriteError('uncertain');return target;
 }
}
