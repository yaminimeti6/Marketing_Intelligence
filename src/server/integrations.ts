import 'server-only';
import { canManageIntegrations, sealToken } from '@/lib/security';
import type { Session } from './auth';
import { withTenant } from './db';

export type Provider = 'meta' | 'shopify';
export const providers = {
  meta: { label: 'Meta Ads', priority: 1, implemented: true },
  shopify: { label: 'Shopify', priority: 2, implemented: true },
} as const;

// Shared storage boundary. Meta OAuth is implemented separately in server/meta.ts.
export async function storeCredential(session: Session, connectionId: string, provider: Provider, token: string) {
  if (!canManageIntegrations(session.role)) throw new Error('Administrator access required.');
  const key = process.env.TOKEN_ENCRYPTION_KEY;
  const keyId = process.env.TOKEN_ENCRYPTION_KEY_ID;
  if (!key || !keyId) throw new Error('Credential encryption is not configured.');
  const envelope = sealToken(token, `${session.workspaceId}:${provider}:${connectionId}`, key);
  await withTenant(session.userId, session.workspaceId, async client => {
    const connection = await client.query('SELECT id FROM provider_connections WHERE id=$1 AND provider=$2 FOR UPDATE', [connectionId, provider]);
    if (!connection.rowCount) throw new Error('Connection not found.');
    await client.query(`INSERT INTO encrypted_credentials(workspace_id, connection_id, envelope, key_id)
      VALUES ($1,$2,$3,$4) ON CONFLICT (workspace_id,connection_id) DO UPDATE SET envelope=$3,key_id=$4,updated_at=now()`, [session.workspaceId, connectionId, envelope, keyId]);
    await client.query('INSERT INTO audit_events(workspace_id,actor_id,action) VALUES($1,$2,$3)', [session.workspaceId, session.userId, 'credential.updated']);
  });
}
