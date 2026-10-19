import {db} from '@/server/db';
import {parseJourney} from '@/lib/journey-pixel';
import {boundedBody} from '@/lib/ai-image';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Cache-Control':'no-store'};
export async function OPTIONS(){return new Response(null,{status:204,headers:cors});}
export async function POST(request:Request){
 if(!request.headers.get('content-type')?.startsWith('text/plain'))return new Response(null,{status:415,headers:cors});
 let event;try{event=parseJourney(JSON.parse(new TextDecoder().decode(await boundedBody(new Response(request.body),2048))),process.env.TOKEN_ENCRYPTION_KEY??'');}catch{return new Response(null,{status:400,headers:cors});}
 try{const r=await db().query('SELECT receive_journey($1,$2,$3,$4,$5,$6,$7,$8) AS result',[event.keyHash,event.eventHash,event.visitorHash,event.customerHash,event.name,event.channel,event.order,event.timestamp]);const result=r.rows[0].result;return new Response(null,{status:['accepted','duplicate'].includes(result)?204:result==='limited'?429:result==='invalid'?400:404,headers:cors});}catch{return new Response(null,{status:503,headers:cors});}
}
