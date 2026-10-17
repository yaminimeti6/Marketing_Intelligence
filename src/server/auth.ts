import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { db, databaseConfigured } from './db';
import { hashToken, type Role } from '@/lib/security';

export const sessionCookie = process.env.NODE_ENV === 'production' ? '__Host-northstar_session' : 'northstar_session';
export type Session = { userId: string; workspaceId: string; name: string; workspace: string; role: Role };
export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(sessionCookie)?.value;
  if (!token || !databaseConfigured()) return null;
  const result = await db().query(`SELECT u.id AS "userId", s.workspace_id AS "workspaceId", u.name,
    w.name AS workspace, m.role FROM sessions s JOIN users u ON u.id=s.user_id
    JOIN memberships m ON m.user_id=s.user_id AND m.workspace_id=s.workspace_id
    JOIN workspaces w ON w.id=s.workspace_id WHERE s.token_hash=$1 AND s.expires_at>now()`, [hashToken(token)]);
  return result.rows[0] ?? null;
}
export async function requireSession() {
  const session = await getSession();
  if (!session) redirect('/login');
  return session;
}
