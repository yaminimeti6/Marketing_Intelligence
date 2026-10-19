import 'server-only';
import type {Session} from './auth';
import {withTenant} from './db';
import {loadShopifyReport} from './shopify-report';
import {loadCombinedOverview} from './combined-overview';
import {salesWindow} from '@/lib/shopify-sales-report';
import {dateFilter} from '@/lib/shopify-products';
import {actualProfit,type ActualCosts} from '@/lib/actual-profit';
export async function loadActualProfit(session:Session|null,q:Record<string,string|undefined>){
 const stores=(await loadShopifyReport(session,{})).stores.map(s=>({id:s.id,name:s.name,currency:s.currency,timezone:s.timezone}));
 const store=stores.find(s=>s.id===q.store)??stores[0];
 const window=salesWindow(store?.timezone??'UTC');const from=dateFilter(q.from)||window.from,to=dateFilter(q.to)||window.to;
 const valid=from<=to&&Date.parse(to)-Date.parse(from)<=90*86400000;
 const base={stores,store,from,to,valid,canEdit:!!session&&['owner','admin'].includes(session.role),ready:false,costs:null as ActualCosts|null,sales:null as string|null,spend:null as string|null,result:null as ReturnType<typeof actualProfit>,updated:null as string|null};
 if(!session||!store||!valid)return base;
 const data=await withTenant(session.userId,session.workspaceId,async c=>{const exists=await c.query("SELECT to_regclass('public.actual_profit_costs') IS NOT NULL AS ready");if(!exists.rows[0].ready)return null;const r=await c.query('SELECT costs,updated_at FROM actual_profit_costs WHERE store_id=$1 AND from_day=$2 AND to_day=$3 AND currency=$4 AND timezone=$5',[store.id,from,to,store.currency,store.timezone]);return r.rows[0]??{};});
 if(data===null)return base;base.ready=true;base.costs=data.costs??null;base.updated=data.updated_at?.toISOString()??null;
 const report=await loadCombinedOverview(session,{start:from,end:to,store:store.id,scope:store.currency+'|'+store.timezone,account:'all'});
 base.sales=report.shopify.netSales;
 const last=Date.parse(report.meta.lastSync??'');const confirmed=(process.env.MER_CHANNELS??'').trim()==='meta';
 base.spend=confirmed&&report.compatible&&report.meta.ready&&report.meta.accounts>0&&!report.dateError&&!report.storeError&&Number.isFinite(last)&&Date.now()-last<=900000&&last<=Date.now()+60000?report.meta.spend:null;
 base.result=actualProfit(base.sales,base.spend,base.costs);return base;
}
export type ActualProfitPage=Awaited<ReturnType<typeof loadActualProfit>>;
