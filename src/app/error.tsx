'use client';
export default function Error({reset}:{reset:()=>void}) {
  return <div className="auth-page"><section className="auth-card"><h1>Workspace unavailable</h1><p>Check the database connection and migration status, then try again. No sample data has been substituted.</p><button className="button primary" onClick={reset}>Try again</button></section></div>;
}
