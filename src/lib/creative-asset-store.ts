import type {PoolClient} from 'pg';import {assetLimits,assetMetadata,type prepareAsset} from './creative-assets.ts';
async function manager(c:PoolClient){const actor=(await c.query("SELECT workspace_id,user_id FROM memberships WHERE workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid AND user_id=nullif(current_setting('app.user_id',true),'')::uuid AND role IN('owner','admin')")).rows[0];if(!actor)throw Error('asset_permission');return actor;}
export async function saveAsset(c:PoolClient,input:unknown,asset:Awaited<ReturnType<typeof prepareAsset>>){
 const actor=await manager(c),meta=assetMetadata(input);await c.query('SELECT pg_advisory_xact_lock(hashtext($1),hashtext($2))',[actor.workspace_id,'creative_assets']);
 const duplicate=(await c.query('SELECT id FROM creative_assets WHERE content_hash=$1',[asset.hash])).rows[0];if(duplicate)return {id:duplicate.id as string,duplicate:true};
 const usage=(await c.query('SELECT count(*)::int AS count,coalesce(sum(octet_length(content)+coalesce(octet_length(thumbnail),0)),0)::int AS bytes FROM creative_assets')).rows[0];
 if(usage.count>=assetLimits.count||usage.bytes+asset.bytes.length+(asset.thumbnail?.length??0)>assetLimits.workspace)throw Error('asset_quota');
 const id=(await c.query('INSERT INTO creative_assets(workspace_id,title,tags,notes,source,kind,mime,content,thumbnail,width,height,content_hash,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id',[actor.workspace_id,meta.title,meta.tags,meta.notes,meta.source,asset.kind,asset.mime,asset.bytes,asset.thumbnail,asset.width,asset.height,asset.hash,actor.user_id])).rows[0].id as string;
 await c.query("INSERT INTO audit_events(workspace_id,actor_id,action) VALUES($1,$2,'creative.asset_saved')",[actor.workspace_id,actor.user_id]);return {id,duplicate:false};
}
export async function changeAsset(c:PoolClient,input:{id:string;revision:number;operation:string;confirmed?:boolean;title?:string;tags?:string;notes?:string}){
 const actor=await manager(c);if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(input.id)||!Number.isSafeInteger(input.revision)||input.revision<1)throw Error('asset_input');
 let changed;if(input.operation==='metadata'){const m=assetMetadata({...input,source:'upload'});changed=await c.query('UPDATE creative_assets SET title=$1,tags=$2,notes=$3,revision=revision+1,updated_at=now() WHERE id=$4 AND revision=$5 RETURNING id',[m.title,m.tags,m.notes,input.id,input.revision]);}
 else if(input.operation==='archive'||input.operation==='restore')changed=await c.query('UPDATE creative_assets SET archived=$1,revision=revision+1,updated_at=now() WHERE id=$2 AND revision=$3 RETURNING id',[input.operation==='archive',input.id,input.revision]);
 else if(input.operation==='delete'&&input.confirmed===true)changed=await c.query('DELETE FROM creative_assets WHERE id=$1 AND revision=$2 AND archived RETURNING id',[input.id,input.revision]);else throw Error('asset_input');
 if(!changed.rowCount)throw Error('asset_conflict');await c.query('INSERT INTO audit_events(workspace_id,actor_id,action) VALUES($1,$2,$3)',[actor.workspace_id,actor.user_id,'creative.'+input.operation]);
}
