import {getSession} from '@/server/auth';import {withTenant} from '@/server/db';
export const runtime='nodejs';
export async function GET(request:Request){
 const session=await getSession();const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'};if(!session)return Response.json({error:'authentication_required'},{status:401,headers});
 const id=new URL(request.url).searchParams.get('run')??'';if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id))return Response.json({error:'report_unavailable'},{status:404,headers});
 try{const row=await withTenant(session.userId,session.workspaceId,async c=>(await c.query('SELECT csv FROM scheduled_report_runs WHERE id=$1 AND csv IS NOT NULL',[id])).rows[0]);if(!row)return Response.json({error:'report_unavailable'},{status:404,headers});return new Response(row.csv,{headers:{...headers,'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="northstar-scheduled-${id}.csv"`}});}catch{return Response.json({error:'report_unavailable'},{status:503,headers});}
}
