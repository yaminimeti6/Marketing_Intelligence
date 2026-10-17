import type {PoolClient} from 'pg';
export async function disconnectConnection(c:PoolClient,id:string){
 if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id))throw new Error('invalid_connection');
 const permission=await c.query("SELECT 1 FROM memberships WHERE workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid AND user_id=nullif(current_setting('app.user_id',true),'')::uuid AND role IN('owner','admin')");if(!permission.rowCount)throw new Error('permission_denied');
 const result=await c.query('SELECT id,provider,status FROM provider_connections WHERE id=$1 FOR UPDATE',[id]);const connection=result.rows[0];if(!connection)throw new Error('permission_denied');
 if(connection.status==='disconnected')return;
 await c.query("UPDATE provider_connections SET status='disconnected',expires_at=NULL WHERE id=$1",[id]);
 await c.query('DELETE FROM encrypted_credentials WHERE connection_id=$1',[id]);
 await c.query("UPDATE sync_jobs SET status='dead',lease_token=NULL,locked_at=NULL,finished_at=now(),last_error_code='connection_disconnected' WHERE connection_id=$1 AND status IN('queued','running')",[id]);
 const table=connection.provider==='meta'?'meta_ad_accounts':null;
 if(table)await c.query(`UPDATE ${table} SET selected=false,accessible=false WHERE connection_id=$1`,[id]);
 if(connection.provider==='shopify'&&(await c.query("SELECT to_regclass('public.shopify_pixel_sources') IS NOT NULL AS ready")).rows[0].ready)await c.query('UPDATE shopify_pixel_sources SET enabled=false WHERE connection_id=$1',[id]);
 await c.query("INSERT INTO audit_events(workspace_id,actor_id,action) VALUES(nullif(current_setting('app.workspace_id',true),'')::uuid,nullif(current_setting('app.user_id',true),'')::uuid,$1)",[`${connection.provider}.disconnected`]);
}
