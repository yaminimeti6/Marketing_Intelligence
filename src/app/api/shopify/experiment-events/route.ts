import {db} from '@/server/db';
import {parseJourney} from '@/lib/journey-pixel';
import {boundedBody} from '@/lib/ai-image';
const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Cache-Control':'no-store'};
export async function OPTIONS(){return new Response(null,{status:204,headers});}
export async function POST(request:Request){
 if(!request.headers.get('content-type')?.startsWith('text/plain'))return new Response(null,{status:415,headers});
 let x:Record<string,unknown>,event;
 try{x=JSON.parse(new TextDecoder().decode(await boundedBody(new Response(request.body),2048)));if(!x||Object.keys(x).some(k=>!['key','id','visitor','timestamp','experiment','variant','analytics','marketing'].includes(k))||typeof x.experiment!=='string'||!/^[a-f0-9-]{36}$/i.test(x.experiment)||!['A','B'].includes(String(x.variant)))throw Error();event=parseJourney({key:x.key,id:x.id,visitor:x.visitor,timestamp:x.timestamp,analytics:x.analytics,marketing:x.marketing,customer:null,order:null,name:'page_viewed',channel:'direct'},process.env.TOKEN_ENCRYPTION_KEY??'');}catch{return new Response(null,{status:400,headers});}
 try{const r=await db().query('SELECT receive_exposure($1,$2,$3,$4,$5) AS result',[event.keyHash,x.experiment,event.visitorHash,x.variant,event.timestamp]);const result=r.rows[0].result;return new Response(null,{status:['accepted','duplicate'].includes(result)?204:result==='limited'?429:result==='invalid'?400:404,headers});}catch{return new Response(null,{status:503,headers});}
}
