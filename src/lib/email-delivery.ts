import {teamEmail} from './team.ts';

export function emailConfiguration(env:Record<string,string|undefined>=process.env){
 const key=env.RESEND_API_KEY?.trim(),from=env.EMAIL_FROM?.trim(),origin=env.APP_URL?.trim();
 if(!key||!/^re_[A-Za-z0-9_-]+$/.test(key)||!from||!origin)return null;
 try{teamEmail(from);const url=new URL(origin);if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.pathname!=='/')return null;
  return {key,from,origin:url.origin};
 }catch{return null;}
}

// The caller must authenticate and authorize the invitation before calling this.
// Never log the provider body: it includes a private single-use invitation link.
export async function deliverInvitation(input:{id:string;email:string;token:string;workspace:string},env:Record<string,string|undefined>=process.env,request:typeof fetch=fetch):Promise<'unconfigured'|'accepted'|'failed'|'invalid_key'|'sender_rejected'|'rate_limited'|'network_failed'>{
 const config=emailConfiguration(env);if(!config)return 'unconfigured';
 if(!/^[a-f0-9-]{36}$/i.test(input.id)||!/^[A-Za-z0-9_-]{43}$/.test(input.token))return 'failed';
 try{
  const email=teamEmail(input.email);
  const response=await request('https://api.resend.com/emails',{method:'POST',redirect:'error',signal:AbortSignal.timeout(10000),headers:{Authorization:`Bearer ${config.key}`,'Content-Type':'application/json','Idempotency-Key':`invitation/${input.id}`},body:JSON.stringify({from:config.from,to:[email],subject:'Your Northstar workspace invitation',text:`You have been invited to ${input.workspace.replace(/[\r\n\x00-\x1f]/g,' ').slice(0,150)} on Northstar.\n\nAccept your invitation: ${config.origin}/invite#${input.token}\n\nThis private link expires in 72 hours and can be used once. If you did not expect this invitation, you can ignore this email.`})});
  if(response.status===401)return 'invalid_key';
  if(response.status===403)return 'sender_rejected';
  if(response.status===429)return 'rate_limited';
  if(!response.ok)return 'failed';
  const result=await response.json() as {id?:unknown};return typeof result.id==='string'&&result.id.length>0?'accepted':'failed';
 }catch{return 'network_failed';}
}
