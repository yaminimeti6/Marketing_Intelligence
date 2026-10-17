import 'server-only';
import type { PoolClient } from 'pg';
import type { Provider } from './integrations';

// Shared durable queue primitives. Dedicated provider workers use leased jobs.
// Call only inside withTenant, after verifying the caller's administrative role.
export async function enqueue(client: PoolClient, workspaceId: string, connectionId: string, provider: Provider, dedupeKey: string) {
  const result = await client.query(`INSERT INTO sync_jobs(workspace_id,connection_id,provider,dedupe_key)
    SELECT workspace_id,id,provider,$4 FROM provider_connections WHERE workspace_id=$1 AND id=$2 AND provider=$3
    ON CONFLICT(workspace_id,provider,dedupe_key) DO NOTHING RETURNING id`,[workspaceId,connectionId,provider,dedupeKey]);
  return result.rows[0]?.id ?? null;
}
export async function claimNext(client: PoolClient, provider: Provider) {
  const result = await client.query(`UPDATE sync_jobs SET status='running',attempts=attempts+1,locked_at=now()
    WHERE (workspace_id,id) IN (SELECT workspace_id,id FROM sync_jobs
      WHERE provider=$1 AND status='queued' AND available_at<=now() ORDER BY available_at,id
      FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *`,[provider]);
  return result.rows[0] ?? null;
}
