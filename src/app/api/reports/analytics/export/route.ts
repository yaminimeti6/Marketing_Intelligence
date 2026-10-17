import {NextResponse} from 'next/server';
import {getSession} from '@/server/auth';
import {loadAnalytics} from '@/server/analytics';
import {analyticsCsv} from '@/lib/analytics';
import {sameOriginPost} from '@/lib/request-origin';
import {withTenant} from '@/server/db';
export async function POST(request:Request){
 const session=await getSession();if(!session)return NextResponse.json({error:'authentication_required'},{status:401});
 if(!sameOriginPost(request))return NextResponse.json({error:'origin_mismatch'},{status:403});
 try{const form=await request.formData(),params=Object.fromEntries(['start','end','provider','account','scope','status','q','compare','columns','sort','direction','group','dimension'].map(k=>[k,String(form.get(k)??'')]));
  const data=await loadAnalytics(session,params),report=analyticsCsv(data,params);
  const allowed=await withTenant(session.userId,session.workspaceId,async c=>{
   await c.query('SELECT pg_advisory_xact_lock(hashtext($1),hashtext($2))',[session.workspaceId,session.userId]);
   if(Number((await c.query("SELECT count(*) FROM report_exports WHERE created_at>now()-interval '1 minute'")).rows[0].count)>=10)return false;
   await c.query('INSERT INTO report_exports(workspace_id,user_id,filters,row_count,complete) VALUES($1,$2,$3,$4,$5)',[session.workspaceId,session.userId,JSON.stringify({...report.filters,report:'analytics'}),report.count,report.complete]);return true;
  });if(!allowed)return NextResponse.json({error:'export_rate_limited'},{status:429,headers:{'Retry-After':'60'}});
  return new Response(report.csv,{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="northstar-analytics.csv"','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
 }catch{return NextResponse.json({error:'analytics_unavailable_check_filters_and_imports'},{status:409,headers:{'Cache-Control':'no-store'}});}
}
