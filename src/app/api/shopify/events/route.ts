import {db} from '@/server/db';
import {parsePixelEvent} from '@/lib/shopify-pixel';
const cors={'Access-Control-Allow-Origin':'*','Cache-Control':'no-store','Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type'};
export async function OPTIONS(){return new Response(null,{status:204,headers:cors});}
export async function POST(request:Request){
 // Sandboxed custom pixels can have an opaque origin. No cookies, sessions or
 // Shopify credentials authorize this endpoint: only a limited write capability.
 if(!request.headers.get('content-type')?.toLowerCase().startsWith('text/plain'))return new Response(null,{status:415,headers:cors});
 const reader=request.body?.getReader();if(!reader)return new Response(null,{status:400,headers:cors});
 const chunks:Uint8Array[]=[];let length=0;
 try{
  while(true){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>2048){await reader.cancel();return new Response(null,{status:413,headers:cors});}chunks.push(value);}
  const data=new Uint8Array(length);let offset=0;for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.length;}
  let event;try{event=parsePixelEvent(JSON.parse(new TextDecoder().decode(data)));}catch{return new Response(null,{status:400,headers:cors});}
  const r=await db().query('SELECT shopify_receive_event($1,$2,$3,$4,$5,$6) AS result',[event.keyHash,event.eventHash,event.name,event.productId,event.quantity,event.timestamp]);
  const result=r.rows[0].result;return new Response(null,{status:result==='accepted'||result==='duplicate'?204:result==='limited'?429:result==='invalid'?400:404,headers:{...cors,...(result==='limited'?{'Retry-After':'60'}:{})}});
 }catch{return new Response(null,{status:503,headers:cors});}finally{reader.releaseLock();}
}
