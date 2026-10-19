import 'server-only';import type {Session} from './auth';import {withTenant} from './db';
export type CreativeLibraryPage={ready:boolean;canEdit:boolean;bytes:number;total:number;assets:{id:string;title:string;tags:string[];notes:string;source:string;kind:'image'|'video';mime:string;width:number|null;height:number|null;bytes:number;archived:boolean;revision:number;created:string}[]};
export async function loadCreativeLibrary(session:Session|null):Promise<CreativeLibraryPage>{
 const empty:CreativeLibraryPage={ready:false,canEdit:!!session&&['owner','admin'].includes(session.role),bytes:0,total:0,assets:[]};if(!session)return empty;
 try{return await withTenant(session.userId,session.workspaceId,async c=>{if(!(await c.query("SELECT to_regclass('public.creative_assets') IS NOT NULL AS ready")).rows[0].ready)return empty;
 const usage=(await c.query('SELECT count(*)::int AS count,coalesce(sum(octet_length(content)+coalesce(octet_length(thumbnail),0)),0)::int AS bytes FROM creative_assets')).rows[0];
 const assets=(await c.query('SELECT id,title,tags,notes,source,kind,mime,width,height,octet_length(content) AS bytes,archived,revision,created_at FROM creative_assets ORDER BY created_at DESC,id LIMIT 50')).rows.map(r=>({...r,created:r.created_at.toISOString(),created_at:undefined}));return {...empty,ready:true,total:usage.count,bytes:usage.bytes,assets};
 });}catch{return empty;}
}
