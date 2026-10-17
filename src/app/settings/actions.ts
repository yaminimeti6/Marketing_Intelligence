'use server';
import {headers,cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {requireSession,sessionCookie} from '@/server/auth';
import {db,withTenant} from '@/server/db';
import {teamCommand,passwordAttempt} from '@/server/team';
import {newToken,hashToken,hashPassword,verifyPassword} from '@/lib/security';
import {teamEmail,teamName,teamPreferences,teamErrorMessage} from '@/lib/team';
import {deliverInvitation} from '@/lib/email-delivery';
import {sameOriginPost} from '@/lib/request-origin';
export type InvitationResult={message:string;link?:string;id?:string};
export async function saveEventRetention(form:FormData){
 const session=await requireSession();let notice='retention_failed';
 try{const days=Number(form.get('days'));if(form.get('confirm')!=='yes'||session.role!=='owner'||!Number.isInteger(days)||days<7||days>90)throw new Error();
  const token=(await cookies()).get(sessionCookie)?.value;if(!token)throw new Error();await withTenant(session.userId,session.workspaceId,async c=>{await c.query("SELECT set_config('app.session_hash',$1,true)",[hashToken(token)]);await c.query('SELECT save_event_retention($1)',[days]);});notice='retention_saved';
 }catch{}revalidatePath('/','layout');redirect('/settings?team_notice='+notice);
}
export async function createInvitation(_previous:InvitationResult,form:FormData):Promise<InvitationResult>{
 try{
  const session=await requireSession(),h=await headers(),origin=h.get('origin');
  if(!origin||!sameOriginPost(new Request(origin,{headers:{origin,host:h.get('host')??''}})))throw new Error('team_permission');
  const email=teamEmail(String(form.get('email')??'')),role=String(form.get('role')??'viewer');if(!['viewer','analyst','admin'].includes(role))throw new Error('team_input');
  const token=newToken();const created=await teamCommand(session,'invite',{email,role,token_hash:hashToken(token)});revalidatePath('/settings');
  const delivery=form.get('send_email')==='yes'?await deliverInvitation({id:created.id,email,token,workspace:session.workspace}):'manual';
  const errors:Record<string,string>={invalid_key:'Resend rejected the API key. Check the full secret key and restart the app.',sender_rejected:'Resend rejected this send. With onboarding@resend.dev, use your Resend account email as the recipient. Other recipients require a verified sender domain. Check domain restrictions on the API key too.',rate_limited:'Resend temporarily limited sending. Check your mail quota and try later.',network_failed:'The mail service could not be reached or timed out. Delivery is unconfirmed; check Resend Emails before retrying.'};
  const message=errors[delivery]?`Invitation created, but email is unconfirmed. ${errors[delivery]} The private link remains available below.`:delivery==='accepted'?'Invitation email accepted by the mail provider. Inbox delivery is not confirmed. The link expires in 72 hours.':delivery==='failed'?'Invitation created, but email delivery could not be confirmed. Share this private link manually or create a new invitation to try again.':delivery==='unconfigured'?'Invitation created. Email sender configuration is missing; share this private link manually.':'Invitation created, not emailed. Share this private link with the invited person. It expires in 72 hours; this link is shown only now.';
  return {message,id:created.id,link:`${origin}/invite#${token}`};
 }catch(error){return {message:teamErrorMessage(error)};}
}
export async function revokeInvitation(form:FormData){
 const session=await requireSession();let notice='revoked';try{await teamCommand(session,'revoke',{id:String(form.get('id')??'')});}catch{notice='action_failed';}revalidatePath('/settings');redirect(`/settings?team_notice=${notice}`);
}
export async function changeTeamMember(form:FormData){
 const session=await requireSession();let notice='member_updated';
 try{if(form.get('confirm')!=='yes')throw new Error('team_input');const action=String(form.get('operation')??'');if(!['role','remove'].includes(action))throw new Error('team_input');await teamCommand(session,action,{user_id:String(form.get('user_id')??''),role:String(form.get('role')??'')});}catch(error){notice=error instanceof Error&&error.message.includes('team_last_owner')?'last_owner':'action_failed';}
 revalidatePath('/settings');redirect(`/settings?team_notice=${notice}`);
}
export async function saveWorkspace(form:FormData){
 const session=await requireSession();let notice='workspace_saved';try{if(form.get('confirm')!=='yes')throw new Error('team_input');await teamCommand(session,'workspace',{name:teamName(String(form.get('name')??''),150),...teamPreferences(String(form.get('currency')??''),String(form.get('timezone')??''))});}catch{notice='action_failed';}revalidatePath('/','layout');redirect(`/settings?team_notice=${notice}`);
}
export async function saveProfile(form:FormData){
 const session=await requireSession();let notice='profile_saved';
 try{
  const name=teamName(String(form.get('name')??'')),password=String(form.get('new_password')??'');const payload:Record<string,string>={name};
  if(password){
   await passwordAttempt('profile:'+session.userId);if(password!==String(form.get('confirm_password')??''))throw new Error('team_input');
   const current=String(form.get('current_password')??'');const result=await db().query('SELECT password_hash FROM users WHERE id=$1',[session.userId]);const hash=result.rows[0]?.password_hash;
   if(!hash||!verifyPassword(current,hash))throw new Error('team_credentials');payload.password_hash=hashPassword(password);payload.verified_password_hash=hash;
  }
  await teamCommand(session,'profile',payload);
 }catch{notice='profile_failed';}revalidatePath('/','layout');redirect(`/settings?team_notice=${notice}`);
}
export async function switchWorkspace(form:FormData){
 const session=await requireSession();let success=false;
 try{const token=newToken();await teamCommand(session,'switch',{workspace_id:String(form.get('workspace_id')??''),token_hash:hashToken(token)});(await cookies()).set(sessionCookie,token,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:28800});success=true;}catch{}
 redirect(success?'/meta':'/settings?team_notice=action_failed');
}
