import 'server-only';
import { Pool, type PoolClient } from 'pg';
import { tenantTransaction } from '@/lib/tenant-db';

const globalDb = globalThis as typeof globalThis & { northstarPool?: Pool };
export function databaseConfigured() { return Boolean(process.env.DATABASE_URL); }
export function db() {
  if (!databaseConfigured()) throw new Error('Database is not configured.');
  return globalDb.northstarPool ??= new Pool({ connectionString: process.env.DATABASE_URL, max: 10, connectionTimeoutMillis: 5000, idleTimeoutMillis: 30000 });
}

// Only authenticated server code supplies userId. Never accept identity from a request body.
// SET LOCAL prevents pooled connections from leaking a previous request's context.
export async function withTenant<T>(userId: string, workspaceId: string, operation: (client: PoolClient) => Promise<T>,snapshot=false) {
  return tenantTransaction(db(),userId,workspaceId,operation,snapshot);
}
