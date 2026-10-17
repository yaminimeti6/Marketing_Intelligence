import {NextResponse} from 'next/server';
import {getSession} from '@/server/auth';
import {withTenant} from '@/server/db';
import {loadShopifyReport} from '@/server/shopify-report';
import {shopifyCsv} from '@/lib/shopify-export';
import {dateFilter} from '@/lib/shopify-products';
import {sameOriginPost} from '@/lib/request-origin';
export async function POST(request:Request){
 const session=await getSession();if(!session)return NextResponse.json({error:'authentication_required'},{status:401});if(!sameOriginPost(request))return NextResponse.json({error:'origin_mismatch'},{status:403});
 try{const form=await request.formData(),raw=Object.fromEntries(['from','to','store','q','status','sort'].map(k=>[k,String(form.get(k)??'')]));if((raw.from&&!dateFilter(raw.from))||(raw.to&&!dateFilter(raw.to))||(raw.from&&raw.to&&raw.from>raw.to)||raw.q.length>120)throw new Error();
  const report=await loadShopifyReport(session,raw),data=shopifyCsv(report,raw.store,raw.q,raw.status||'all',raw.sort);
  const allowed=await withTenant(session.userId,session.workspaceId,async c=>{await c.query('SELECT pg_advisory_xact_lock(hashtext($1),hashtext($2))',[session.workspaceId,session.userId]);if(Number((await c.query("SELECT count(*) FROM report_exports WHERE created_at>now()-interval '1 minute'")).rows[0].count)>=10)return false;await c.query('INSERT INTO report_exports(workspace_id,user_id,filters,row_count,complete) VALUES($1,$2,$3,$4,false)',[session.workspaceId,session.userId,JSON.stringify({...raw,report:'shopify'}),data.count]);return true;});if(!allowed)return NextResponse.json({error:'export_rate_limited'},{status:429,headers:{'Retry-After':'60'}});
  return new Response(data.csv,{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="northstar-shopify-products.csv"','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
 }catch{return NextResponse.json({error:'shopify_export_unavailable_check_filters_and_imports'},{status:409,headers:{'Cache-Control':'no-store'}});}
}
