'use server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { db, databaseConfigured } from '@/server/db';
import { sessionCookie } from '@/server/auth';
import { hashToken, newToken, verifyPassword } from '@/lib/security';

export async function signIn(form: FormData) {
  if (!databaseConfigured()) redirect('/login?error=setup');
  const email = String(form.get('email') ?? '').trim().toLowerCase();
  const password = String(form.get('password') ?? '');
  if (!email || email.length > 254 || !password || password.length > 256) redirect('/login?error=invalid');
  let authenticated = false;
  let limited = false;
  try {
    const attempts = await db().query(`INSERT INTO login_attempts(identity_hash,attempts) VALUES($1,1)
      ON CONFLICT(identity_hash) DO UPDATE SET
      attempts=CASE WHEN login_attempts.window_start<now()-interval '15 minutes' THEN 1 ELSE login_attempts.attempts+1 END,
      window_start=CASE WHEN login_attempts.window_start<now()-interval '15 minutes' THEN now() ELSE login_attempts.window_start END RETURNING attempts`, [hashToken(email)]);
    if (attempts.rows[0].attempts <= 10) {
      const result = await db().query(`SELECT u.id,u.password_hash,m.workspace_id FROM users u
        JOIN memberships m ON m.user_id=u.id WHERE u.email=$1 ORDER BY m.workspace_id LIMIT 1`, [email]);
      const user = result.rows[0];
      // Constant-cost password verification also for unknown identities.
      const dummy = '0'.repeat(32) + ':' + '0'.repeat(128);
      const valid = verifyPassword(password, user?.password_hash ?? dummy);
      if (user && valid) {
        await db().query('UPDATE login_attempts SET attempts=0 WHERE identity_hash=$1', [hashToken(email)]);
        const token = newToken();
        await db().query("INSERT INTO sessions(token_hash,user_id,workspace_id,expires_at) VALUES($1,$2,$3,now()+interval '8 hours')", [hashToken(token), user.id, user.workspace_id]);
        (await cookies()).set(sessionCookie, token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 8 * 60 * 60 });
        authenticated = true;
      }
    } else { limited = true; }
  } catch { redirect('/login?error=unavailable'); }
  if (limited) redirect('/login?error=limited');
  if (!authenticated) redirect('/login?error=invalid');
  redirect('/meta');
}
export async function signOut() {
  const jar = await cookies();
  const token = jar.get(sessionCookie)?.value;
  if (token && databaseConfigured()) await db().query('DELETE FROM sessions WHERE token_hash=$1', [hashToken(token)]);
  jar.delete(sessionCookie);
  redirect('/login');
}

