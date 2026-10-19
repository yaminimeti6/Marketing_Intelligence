'use server';
import {requireSession} from '@/server/auth';
import {withTenant} from '@/server/db';
import {actualCostFields,moneyUnits,moneyDecimal} from '@/lib/actual-profit';
import {dateFilter} from '@/lib/shopify-products';
import {revalidatePath} from 'next/cache';
export async function saveActualCosts(_previous:{message:string},form:FormData){
 const session=await requireSession();if(!['owner','admin'].includes(session.role))return {message:'Owner or admin access required.'};
 try{const from=dateFilter(form.get('from')),to=dateFilter(form.get('to')),store=String(form.get('store')??'');if(!from||!to||from>to||Date.parse(to)-Date.parse(from)>90*86400000||form.get('confirmed')!=='yes')throw Error();
 const costs=Object.fromEntries(actualCostFields.map(k=>[k,moneyDecimal(moneyUnits(String(form.get(k)??'')))]));
 await withTenant(session.userId,session.workspaceId,async c=>{const s=await c.query('SELECT currency,timezone_name AS timezone FROM shopify_stores WHERE connection_id=$1',[store]);if(!s.rowCount)throw Error();await c.query('INSERT INTO actual_profit_costs(workspace_id,store_id,from_day,to_day,currency,timezone,costs,updated_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(workspace_id,store_id,from_day,to_day) DO UPDATE SET costs=excluded.costs,currency=excluded.currency,timezone=excluded.timezone,updated_by=excluded.updated_by,updated_at=now()',[session.workspaceId,store,from,to,s.rows[0].currency,s.rows[0].timezone,JSON.stringify(costs),session.userId]);await c.query("INSERT INTO audit_events(workspace_id,actor_id,action) VALUES($1,$2,'profit.actual_costs_saved')",[session.workspaceId,session.userId]);});revalidatePath('/profit-analytics');return {message:'Actual costs saved for this exact store and period.'};
 }catch{return {message:'Could not save. Complete every amount, choose a valid period of at most 91 days and confirm actual cost coverage.'};}
}
