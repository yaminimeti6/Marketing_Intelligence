import type { Pool, PoolClient } from 'pg';
export async function tenantTransaction<T>(pool:Pool,userId:string,workspaceId:string,operation:(client:PoolClient)=>Promise<T>,snapshot=false) {
  const client=await pool.connect();
  try{
    await client.query(snapshot?'BEGIN ISOLATION LEVEL REPEATABLE READ':'BEGIN');
    const role=await client.query('SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user');
    if(role.rows[0].rolsuper||role.rows[0].rolbypassrls)throw new Error('Unsafe runtime role.');
    await client.query("SELECT set_config('app.user_id',$1,true),set_config('app.workspace_id',$2,true)",[userId,workspaceId]);
    const membership=await client.query('SELECT role FROM memberships WHERE user_id=$1 AND workspace_id=$2',[userId,workspaceId]);
    if(!membership.rowCount)throw new Error('Workspace access denied.');
    const result=await operation(client);await client.query('COMMIT');return result;
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}
