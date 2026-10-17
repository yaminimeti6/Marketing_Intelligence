import type {PoolClient} from 'pg';
import {ruleDefinition,evaluateRule,type RuleDefinition,type RuleResult} from './alert-rules.ts';
import {ruleAccounts,ruleAnalytics} from './rule-data.ts';
const uuid=(id:string)=>/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id);
async function manager(c:PoolClient){const r=await c.query("SELECT workspace_id,user_id FROM memberships WHERE workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid AND user_id=nullif(current_setting('app.user_id',true),'')::uuid AND role IN('owner','admin')");if(!r.rowCount)throw new Error('rule_permission');return r.rows[0] as {workspace_id:string;user_id:string};}
export async function saveRule(c:PoolClient,input:unknown,enabled:boolean,id=''){
 const actor=await manager(c),definition=ruleDefinition(input);if(id&&!uuid(id))throw new Error('rule_input');
 const accounts=await ruleAccounts(c);if(!accounts.some(a=>(definition.provider==='all'||a.provider===definition.provider)&&`${a.currency}|${a.timezone}`===definition.scope&&(definition.account==='all'||a.key===definition.account)))throw new Error('rule_account_unavailable');
 await c.query('SELECT pg_advisory_xact_lock(hashtext($1),hashtext($2))',[actor.workspace_id,'alert_rules']);
 let ruleId=id;
 if(id){const r=await c.query('UPDATE alert_rules SET definition=$1,enabled=$2,updated_at=now(),last_checked_at=NULL,last_result=NULL WHERE id=$3 RETURNING id',[JSON.stringify(definition),enabled,id]);if(!r.rowCount)throw new Error('rule_permission');}
 else {if(Number((await c.query('SELECT count(*) FROM alert_rules')).rows[0].count)>=50)throw new Error('rule_limit');ruleId=(await c.query('INSERT INTO alert_rules(workspace_id,created_by,definition,enabled) VALUES($1,$2,$3,$4) RETURNING id',[actor.workspace_id,actor.user_id,JSON.stringify(definition),enabled])).rows[0].id;}
 await c.query('INSERT INTO audit_events(workspace_id,actor_id,action) VALUES($1,$2,$3)',[actor.workspace_id,actor.user_id,id?'rules.updated':'rules.created']);return ruleId;
}
export async function toggleRule(c:PoolClient,id:string,enabled:boolean){
 const actor=await manager(c);if(!uuid(id))throw new Error('rule_input');const result=await c.query('UPDATE alert_rules SET enabled=$1,updated_at=now(),last_checked_at=NULL,last_result=NULL WHERE id=$2 RETURNING id',[enabled,id]);if(!result.rowCount)throw new Error('rule_permission');await c.query('INSERT INTO audit_events(workspace_id,actor_id,action) VALUES($1,$2,$3)',[actor.workspace_id,actor.user_id,enabled?'rules.enabled':'rules.disabled']);
}
export async function reviewAlert(c:PoolClient,id:string){
 const actor=await manager(c);if(!uuid(id))throw new Error('rule_input');const r=await c.query('UPDATE rule_alerts SET reviewed_at=now(),reviewed_by=$1 WHERE id=$2 AND reviewed_at IS NULL RETURNING id',[actor.user_id,id]);if(!r.rowCount)throw new Error('rule_permission');await c.query("INSERT INTO audit_events(workspace_id,actor_id,action) VALUES($1,$2,'rules.alert_reviewed')",[actor.workspace_id,actor.user_id]);
}
export type StoredRuleRun={outcome:'skipped'|'dry_run'|'evaluated'|'cooldown'|'alert_created';result?:RuleResult};
export async function runRule(c:PoolClient,id:string,options:{dryRun?:boolean;automatic?:boolean;now?:Date}={}):Promise<StoredRuleRun>{
 const actor=await manager(c);if(!uuid(id))throw new Error('rule_input');
 const row=(await c.query('SELECT * FROM alert_rules WHERE id=$1 FOR UPDATE',[id])).rows[0];if(!row)throw new Error('rule_permission');
 const now=options.now??new Date(),dryRun=options.dryRun===true;
 if(!dryRun&&!row.enabled)return {outcome:'skipped'};
 const retryMs=row.last_result?.retryAfterSeconds===10?10000:60000;
 if(options.automatic&&row.last_checked_at&&now.getTime()-row.last_checked_at.getTime()<retryMs)return {outcome:'skipped'};
 const definition=ruleDefinition(row.definition),data=await ruleAnalytics(c,definition,now),result=evaluateRule(definition,data,now);
 const cooling=!!row.last_alert_at&&now.getTime()-row.last_alert_at.getTime()<definition.cooldownHours*3600000;
 const outcome=dryRun?'dry_run':result.status==='matched'?cooling?'cooldown':'alert_created':'evaluated';
 if(outcome==='alert_created'){
  await c.query('INSERT INTO rule_alerts(workspace_id,rule_id,rule_name,definition,result) VALUES($1,$2,$3,$4,$5)',[actor.workspace_id,id,definition.name,JSON.stringify(definition),JSON.stringify(result)]);
  await c.query('UPDATE alert_rules SET last_alert_at=$1 WHERE id=$2',[now,id]);
  await c.query("INSERT INTO audit_events(workspace_id,actor_id,action) VALUES($1,$2,'rules.alert_created')",[actor.workspace_id,actor.user_id]);
 }
 const retryAfterSeconds=result.status==='unavailable'&&data.jobs.some(j=>j.status==='queued'||j.status==='running')?10:60;
 if(!dryRun)await c.query('UPDATE alert_rules SET last_checked_at=$1,last_result=$2 WHERE id=$3',[now,JSON.stringify({...result,outcome,retryAfterSeconds}),id]);
 // Automatic unchanged checks update the rule summary without generating a log row every minute.
 if(!options.automatic||row.last_result?.status!==result.status||outcome==='alert_created')await c.query('INSERT INTO alert_rule_runs(workspace_id,rule_id,actor_id,dry_run,result,definition,outcome) VALUES($1,$2,$3,$4,$5,$6,$7)',[actor.workspace_id,id,actor.user_id,dryRun,JSON.stringify(result),JSON.stringify(definition),outcome]);
 return {outcome,result};
}
