import {getSession} from '@/server/auth';import {withTenant} from '@/server/db';import {mediaRange} from '@/lib/creative-assets';
export const runtime='nodejs';
export async function GET(request:Request){
 const headers:Record<string,string>={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; sandbox"};const session=await getSession();if(!session)return Response.json({error:'authentication_required'},{status:401,headers});
 const q=new URL(request.url).searchParams,id=q.get('id')??'';if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id))return Response.json({error:'asset_unavailable'},{status:404,headers});
 try{const thumb=q.get('thumb')==='1';const row=await withTenant(session.userId,session.workspaceId,async c=>(await c.query(`SELECT mime,${thumb?'thumbnail':'content'} AS bytes FROM creative_assets WHERE id=$1`,[id])).rows[0]);if(!row?.bytes)return Response.json({error:'asset_unavailable'},{status:404,headers});const bytes=row.bytes as Buffer,mime=thumb?'image/webp':row.mime;headers['Content-Type']=mime;headers['Content-Disposition']=(q.get('download')==='1'?'attachment':'inline')+`; filename="northstar-creative-${id}.${mime==='video/mp4'?'mp4':mime==='video/webm'?'webm':'webp'}"`;headers['Accept-Ranges']='bytes';
 let range;try{range=mediaRange(request.headers.get('range'),bytes.length);}catch{return new Response(null,{status:416,headers:{...headers,'Content-Range':`bytes */${bytes.length}`}});}
 if(range){headers['Content-Range']=`bytes ${range.start}-${range.end}/${bytes.length}`;headers['Content-Length']=String(range.end-range.start+1);return new Response(new Uint8Array(bytes.subarray(range.start,range.end+1)),{status:206,headers});}headers['Content-Length']=String(bytes.length);return new Response(new Uint8Array(bytes),{headers});
 }catch{return Response.json({error:'asset_unavailable'},{status:503,headers});}
}
