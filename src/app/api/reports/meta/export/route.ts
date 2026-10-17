import {NextResponse} from 'next/server';
import {getSession} from '@/server/auth';
import {loadMetaReport} from '@/server/meta-report';
import {withTenant} from '@/server/db';
import {makeMetaCsv} from '@/lib/meta-export';
import {metaQueryValues} from '@/lib/meta-report';
import {sameOriginPost} from '@/lib/request-origin';
export const runtime='nodejs';
export async function POST(request:Request){
 const session=await getSession();if(!session)return NextResponse.json({error:'authentication_required'},{status:401});
 if(!sameOriginPost(request))return NextResponse.json({error:'origin_mismatch'},{status:403});
 try{
  const form=await request.formData();const params=Object.fromEntries(['start','end','account','scope','compare','level','parent','status','q'].map(k=>[k,String(form.get(k)??'')]));
  const report=await loadMetaReport(session,params);const rawSort=String(form.get('sort')??'spend');const sort=['name','spend','purchases','roas'].includes(rawSort)?rawSort:'spend';const data=makeMetaCsv(report,sort);
  const recorded=await withTenant(session.userId,session.workspaceId,async c=>{
   await c.query('SELECT pg_advisory_xact_lock(hashtext($1),hashtext($2))',[session.workspaceId,session.userId]);
   const recent=await c.query("SELECT count(*)::int AS count FROM report_exports WHERE created_at>now()-interval '1 minute'");if(recent.rows[0].count>=10)return false;
   await c.query('INSERT INTO report_exports(workspace_id,user_id,filters,row_count,complete) VALUES($1,$2,$3,$4,$5)',[session.workspaceId,session.userId,JSON.stringify({...metaQueryValues(report.query),sort}),data.count,data.complete]);return true;
  });
  if(!recorded)return NextResponse.json({error:'export_rate_limited'},{status:429,headers:{'Retry-After':'60','Cache-Control':'no-store'}});
  return new Response(data.csv,{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="northstar-meta-${report.query.level}-${report.query.start}-${report.query.end}.csv"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}});
 }catch{return NextResponse.json({error:'report_unavailable_check_filters_access_and_reporting_storage'},{status:409,headers:{'Cache-Control':'no-store'}});}
}
