'use server';
import {revalidatePath} from 'next/cache';
import {requireSession} from '@/server/auth';
import {withTenant} from '@/server/db';
import {saveRule,toggleRule,runRule,reviewAlert} from '@/lib/rule-store';
export type RuleActionState={message:string};
export async function saveAlertRule(_previous:RuleActionState,form:FormData):Promise<RuleActionState>{
 const session=await requireSession();
 try{const metrics=form.getAll('metric').map(String),operators=form.getAll('operator').map(String),thresholds=form.getAll('threshold').map(String);if(metrics.length!==operators.length||metrics.length!==thresholds.length)throw new Error();
  const input={name:String(form.get('name')??''),provider:String(form.get('provider')??''),scope:String(form.get('scope')??''),account:String(form.get('account')??'all'),days:Number(form.get('days')),logic:String(form.get('logic')??'all'),cooldownHours:Number(form.get('cooldown')),conditions:metrics.map((metric,i)=>({metric,operator:operators[i],threshold:thresholds[i]}))};
  await withTenant(session.userId,session.workspaceId,c=>saveRule(c,input,form.get('enabled')==='yes',String(form.get('id')??'')));revalidatePath('/alerts');return {message:'Rule saved. Enabled rules create in-app alerts when the local workers runner is active. No email or ad changes are made.'};
 }catch{return {message:'Rule could not be saved. Check Owner/Admin access, source account, conditions and field limits (maximum 50 rules).'};}
}
export async function ruleOperation(_previous:RuleActionState,form:FormData):Promise<RuleActionState>{
 const session=await requireSession();
 try{const id=String(form.get('id')??''),operation=String(form.get('operation')??'');let message='Action completed.';
  await withTenant(session.userId,session.workspaceId,async c=>{
   if(operation==='enable'||operation==='disable'){await toggleRule(c,id,operation==='enable');message=operation==='enable'?'Rule enabled for automatic checks.':'Rule disabled. Existing alerts and audit history are retained.';}
   else if(operation==='review'){await reviewAlert(c,id);message='Alert marked reviewed for this workspace.';}
   else if(operation==='dry_run'||operation==='run'){
    const run=await runRule(c,id,{dryRun:operation==='dry_run'});message=run.outcome==='skipped'?'Rule is disabled. Use Dry run to preview it.':run.outcome==='dry_run'?`Dry run: ${run.result!.status.replaceAll('_',' ')}. ${run.result!.reason} No alert was created and cooldown was unchanged.`:run.outcome==='alert_created'?'An in-app alert was created.':run.outcome==='cooldown'?'Conditions matched, but cooldown prevented another alert.':run.result!.reason;
   }else throw new Error();
  },true);revalidatePath('/alerts');return {message};
 }catch{return {message:'Action could not complete. Check your current role and source availability, then retry.'};}
}
