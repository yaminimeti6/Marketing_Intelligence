import {getSession} from '@/server/auth';import {withTenant} from '@/server/db';import {sameOriginPost} from '@/lib/request-origin';import {boundedBody} from '@/lib/ai-image';import {prepareAsset} from '@/lib/creative-assets';import {saveAsset,changeAsset} from '@/lib/creative-asset-store';
export const runtime='nodejs';export const maxDuration=30;
export async function POST(request:Request){
 const fail=(error:string,status:number)=>Response.json({error},{status,headers:{'Cache-Control':'no-store'}});
 if(!sameOriginPost(request))return fail('Request origin rejected.',403);const session=await getSession();if(!session)return fail('Sign in again.',401);if(!['owner','admin'].includes(session.role))return fail('Owner or admin access required.',403);
 try{const type=request.headers.get('content-type')??'';
 if(type.startsWith('multipart/form-data')){
 const body=await boundedBody(new Response(request.body,{headers:{'Content-Type':type}}),4200000);const form=await new Response(body,{headers:{'Content-Type':type}}).formData();const file=form.get('file');if(!(file instanceof File))return fail('Choose an image or video file.',400);
 const asset=await prepareAsset(new Uint8Array(await file.arrayBuffer()),file.type);const result=await withTenant(session.userId,session.workspaceId,c=>saveAsset(c,{title:String(form.get('title')??''),tags:String(form.get('tags')??''),notes:String(form.get('notes')??''),source:String(form.get('source')??'upload')},asset));return Response.json({...result,message:result.duplicate?'This content is already saved, possibly in the archive.':'Creative saved.'},{headers:{'Cache-Control':'no-store'}});
 }
 if(type.startsWith('application/json')){const bytes=await boundedBody(new Response(request.body),4000);const input=JSON.parse(new TextDecoder().decode(bytes));await withTenant(session.userId,session.workspaceId,c=>changeAsset(c,input));return Response.json({message:'Creative updated.'},{headers:{'Cache-Control':'no-store'}});}return fail('Unsupported request format.',415);
 }catch(e){const code=e instanceof Error?e.message:'';return fail(code==='asset_quota'?'Library limit reached: 50 items or 30 MB including archived files. Delete archived files to free space.':code==='asset_conflict'?'Asset changed or is unavailable. Refresh before trying again.':'Could not save. Use JPEG/PNG/static WebP up to 2 MB, MP4/WebM up to 4 MB, and valid title/tags. Images must be at most 16 megapixels.',400);}
}
