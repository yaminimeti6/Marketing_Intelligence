import Link from 'next/link';
import LoginForm from '@/components/login-form';
import { databaseConfigured } from '@/server/db';
export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const configured = databaseConfigured();
  const message = error === 'invalid' ? 'Sign-in failed or too many attempts. Check your credentials or retry after 15 minutes.' : error === 'unavailable' ? 'Authentication is unavailable. Check database setup and availability.' : 'Configure PostgreSQL and create a workspace owner using the setup guide.';
  return <div className="auth-page"><section className="auth-card"><Link className="auth-brand" href="/">✦ NORTHSTAR</Link><div className="eyebrow">MARKETING INTELLIGENCE</div><h1>Welcome back</h1><p>Sign in to your marketing workspace.</p>{(!configured || error) && <div className="foundation-notice" role="status">{message}</div>}<LoginForm configured={configured} /><p className="auth-footnote">Accounts are provisioned by your workspace administrator. Meta and Shopify authorization are separate, later steps.</p><Link className="text-button" href="/">View foundation layout →</Link></section></div>;
}
