'use server';
import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import {getSession,sessionCookie} from '@/server/auth';
import {db} from '@/server/db';
import {passwordAttempt} from '@/server/team';
import {hashToken,newToken,hashPassword,verifyPassword} from '@/lib/security';
import {inviteToken,teamName,teamErrorMessage} from '@/lib/team';
export type AcceptResult={message:string};
export async function acceptInvitation(_previous:AcceptResult,form:FormData):Promise<AcceptResult>{
 let success=false;
 try{
  const token=inviteToken(String(form.get('token')??'')),hash=hashToken(token);await passwordAttempt('invite:'+hash);
  const invitation=(await db().query('SELECT team_invite_target($1) AS invite',[hash])).rows[0].invite;if(!invitation)throw new Error('team_invite_invalid');
  const session=await getSession(),jar=await cookies(),current=jar.get(sessionCookie)?.value;
  const result=await db().query('SELECT id,password_hash FROM users WHERE email=$1',[invitation.email]);const user=result.rows[0];
  let newHash:string|null=null,verifiedHash:string|null=null,name:string|null=null;
  if(session){if(!user||session.userId!==user.id)throw new Error('team_credentials');}
  else if(user){if(!verifyPassword(String(form.get('password')??''),user.password_hash))throw new Error('team_credentials');verifiedHash=user.password_hash;}
  else{name=teamName(String(form.get('name')??''));const password=String(form.get('password')??'');if(password!==String(form.get('confirm_password')??''))throw new Error('team_input');newHash=hashPassword(password);}
  const fresh=newToken(),client=await db().connect();
  try{
   await client.query('BEGIN');await client.query("SELECT set_config('app.session_hash',$1,true)",[current?hashToken(current):'']);
   await client.query('SELECT team_accept_invite($1,$2,$3,$4,$5)',[hash,name,newHash,verifiedHash,hashToken(fresh)]);await client.query('COMMIT');
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  jar.set(sessionCookie,fresh,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:28800});success=true;
 }catch(error){return {message:teamErrorMessage(error)};}
 if(success)redirect('/settings?team_notice=joined');return {message:'Invitation could not complete.'};
}
