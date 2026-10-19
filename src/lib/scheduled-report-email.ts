import {emailConfiguration} from './email-delivery.ts';
import {teamEmail} from './team.ts';
export type ReportMailResult={status:'accepted'|'failed'|'uncertain';code:string|null;providerId?:string};
export async function sendScheduledReport(input:{run:string;email:string;name:string;from:string;to:string},env:Record<string,string|undefined>=process.env,request:typeof fetch=fetch):Promise<ReportMailResult>{
 const config=emailConfiguration(env);if(!config)return {status:'failed',code:'email_not_configured'};
 if(!/^[a-f0-9-]{36}$/i.test(input.run))return {status:'failed',code:'invalid_report'};
 try{const recipient=teamEmail(input.email);const response=await request('https://api.resend.com/emails',{method:'POST',redirect:'error',signal:AbortSignal.timeout(10000),headers:{Authorization:`Bearer ${config.key}`,'Content-Type':'application/json','Idempotency-Key':'scheduled-report/'+input.run},body:JSON.stringify({from:config.from,to:[recipient],subject:'Northstar scheduled report is ready',text:`Your scheduled report is ready: ${input.name.replace(/[\x00-\x1f\x7f]/g,' ').slice(0,80)}\nPeriod: ${input.from} through ${input.to}\n\nSign in to your workspace to view and download:\n${config.origin}/scheduled-reports?run=${input.run}\n\nAccess requires current workspace membership. No attachment is included.`})});
 if(!response.ok)return {status:response.status>=500?'uncertain':'failed',code:response.status===401?'invalid_key':response.status===403?'sender_rejected':response.status===429?'rate_limited':response.status>=500?'provider_unconfirmed':'provider_rejected'};
 const result=await response.json() as {id?:unknown};if(typeof result.id!=='string'||!result.id||result.id.length>200)return {status:'uncertain',code:'provider_unconfirmed'};return {status:'accepted',code:null,providerId:result.id};
 }catch{return {status:'uncertain',code:'delivery_unconfirmed'};}
}
