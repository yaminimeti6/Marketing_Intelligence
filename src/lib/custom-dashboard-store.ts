import type {PoolClient} from 'pg';import {dashboardDefinition} from './custom-dashboard.ts';import {ruleAccounts} from './rule-data.ts';
export async function saveCustomDashboard(c:PoolClient,value:unknown,id='',revision=0){
 const actor=(await c.query("SELECT workspace_id,user_id FROM memberships WHERE workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid AND user_id=nullif(current_setting('app.user_id',true),'')::uuid AND role IN('owner','admin')")).rows[0];if(!actor)throw Error('dashboard_permission');
 const definition=dashboardDefinition(value),accounts=await ruleAccounts(c);
 if(definition.scope&&!accounts.some(a=>`${a.currency}|${a.timezone}`===definition.scope&&(definition.account==='all'||a.key.slice(5)===definition.account)))throw Error('dashboard_source');if(!definition.scope&&definition.account!=='all')throw Error('dashboard_source');
 if(definition.store&&!(await c.query('SELECT connection_id FROM shopify_stores WHERE connection_id=$1',[definition.store])).rowCount)throw Error('dashboard_source');
 await c.query('SELECT pg_advisory_xact_lock(hashtext($1),hashtext($2))',[actor.workspace_id,'custom_dashboards']);let saved:string;
 if(id){if(!/^[a-f0-9-]{36}$/i.test(id)||!Number.isSafeInteger(revision)||revision<1)throw Error('dashboard_input');const r=await c.query('UPDATE custom_dashboards SET definition=$1,updated_by=$2,updated_at=now(),revision=revision+1 WHERE id=$3 AND revision=$4 RETURNING id',[JSON.stringify(definition),actor.user_id,id,revision]);if(!r.rowCount)throw Error('dashboard_conflict');saved=r.rows[0].id;}
 else{if(Number((await c.query('SELECT count(*) FROM custom_dashboards')).rows[0].count)>=10)throw Error('dashboard_limit');saved=(await c.query('INSERT INTO custom_dashboards(workspace_id,definition,updated_by) VALUES($1,$2,$3) RETURNING id',[actor.workspace_id,JSON.stringify(definition),actor.user_id])).rows[0].id;}
 await c.query("INSERT INTO audit_events(workspace_id,actor_id,action) VALUES($1,$2,$3)",[actor.workspace_id,actor.user_id,id?'dashboard.updated':'dashboard.created']);return saved;
}
