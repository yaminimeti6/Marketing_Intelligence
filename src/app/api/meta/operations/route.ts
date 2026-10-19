import {getSession} from '@/server/auth';
import {approveMetaOperation,stepMetaOperation} from '@/server/meta-operations';
import {sameOriginPost} from '@/lib/request-origin';
import {boundedBody} from '@/lib/ai-image';
export const maxDuration=60;
export async function POST(request:Request){
 const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
 if(!sameOriginPost(request))return json({error:'Request origin rejected.'},403);
 const session=await getSession();if(!session)return json({error:'Sign in again.'},401);if(!['owner','admin'].includes(session.role))return json({error:'Owner/admin access required.'},403);
 let x:Record<string,unknown>;try{x=JSON.parse(new TextDecoder().decode(await boundedBody(new Response(request.body),2000)));if(!x||typeof x.id!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(x.id)||!['approve','step'].includes(String(x.action)))throw Error();}catch{return json({error:'Invalid operation request.'},400);}
 try{if(x.action==='approve'){await approveMetaOperation(session,x.id as string,String(x.confirmation??''),x.acknowledge===true);return json({approved:true});}return json(await stepMetaOperation(session,x.id as string));}catch(e){return json({error:e instanceof Error&&!('code' in e)?e.message:'Operation unavailable. Review history before retrying.'},409);}
}
