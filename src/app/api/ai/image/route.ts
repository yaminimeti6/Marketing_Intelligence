import {getSession} from '@/server/auth';
import {reserveAiAttempt} from '@/server/ai-usage';
import {sameOriginPost} from '@/lib/request-origin';
import {boundedBody,generateImage,imageBrief,imageConfiguration} from '@/lib/ai-image';
export const maxDuration=60;
export async function POST(request:Request){
 const fail=(error:string,status:number)=>Response.json({error},{status,headers:{'Cache-Control':'no-store'}});
 if(!sameOriginPost(request))return fail('Request origin rejected.',403);
 const session=await getSession();if(!session)return fail('Sign in again before generating.',401);
 if(!['owner','admin'].includes(session.role))return fail('Only owners and admins can generate paid images.',403);
 if(!request.headers.get('content-type')?.startsWith('application/json'))return fail('Send a JSON image brief.',400);
 let prompt:string;
 try{const bytes=await boundedBody(new Response(request.body),5000);prompt=imageBrief(JSON.parse(new TextDecoder().decode(bytes)).prompt);}catch{return fail('Describe the image in 10–1,000 characters.',400);}
 try{imageConfiguration(process.env);}catch(e){return fail((e as Error).message,503);}
 try{if(!await reserveAiAttempt(session,true))return fail('Image limit reached: 2 attempts per workspace per hour, within the shared 10 AI attempts/hour limit.',429);}catch{return fail('Image request could not be authorized. No provider request sent.',503);}
 try{const bytes=await generateImage(prompt,process.env);return new Response(bytes,{headers:{'Content-Type':'image/jpeg','Content-Disposition':'attachment; filename="northstar-ai-image.jpg"','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});}catch(e){return fail((e as Error).message,502);}
}
