import 'server-only';
import type {Session} from './auth';
import {withTenant} from './db';
import {canManageIntegrations} from '@/lib/security';
import {ruleAccounts} from '@/lib/rule-data';
import {ruleDefinition,type RuleDefinition,type RuleResult} from '@/lib/alert-rules';
import type {AnalyticsAccount} from '@/lib/analytics';
export type RulesPage={ready:boolean;available:boolean;canManage:boolean;accounts:AnalyticsAccount[];rules:{id:string;definition:RuleDefinition;enabled:boolean;updated:string;lastChecked:string|null;lastAlert:string|null;lastResult:(RuleResult&{outcome:string})|null}[];alerts:{id:string;name:string;definition:RuleDefinition;result:RuleResult;created:string;reviewed:string|null}[];runs:{id:string;ruleId:string;name:string;result:RuleResult;outcome:string;created:string}[]};
export async function loadRules(session:Session|null):Promise<RulesPage>{
 const page:RulesPage={ready:false,available:true,canManage:!!session&&canManageIntegrations(session.role),accounts:[],rules:[],alerts:[],runs:[]};if(!session)return page;
 try{return await withTenant(session.userId,session.workspaceId,async c=>{
  if(!(await c.query("SELECT to_regclass('public.alert_rules') IS NOT NULL AS ready")).rows[0].ready)return page;page.ready=true;page.accounts=await ruleAccounts(c);
  const rules=await c.query('SELECT * FROM alert_rules ORDER BY created_at DESC LIMIT 50');page.rules=rules.rows.map(r=>({id:r.id,definition:ruleDefinition(r.definition),enabled:r.enabled,updated:r.updated_at.toISOString(),lastChecked:r.last_checked_at?.toISOString()??null,lastAlert:r.last_alert_at?.toISOString()??null,lastResult:r.last_result}));
  const alerts=await c.query('SELECT id,rule_name,definition,result,created_at,reviewed_at FROM rule_alerts ORDER BY created_at DESC LIMIT 50');page.alerts=alerts.rows.map(r=>({id:r.id,name:r.rule_name,definition:r.definition,result:r.result,created:r.created_at.toISOString(),reviewed:r.reviewed_at?.toISOString()??null}));
  const runs=await c.query('SELECT id,rule_id,definition,result,outcome,created_at FROM alert_rule_runs ORDER BY created_at DESC LIMIT 50');page.runs=runs.rows.map(r=>({id:r.id,ruleId:r.rule_id,name:r.definition.name,result:r.result,outcome:r.outcome,created:r.created_at.toISOString()}));return page;
 },true);}catch{return {...page,available:false};}
}
