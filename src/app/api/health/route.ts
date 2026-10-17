import { db, databaseConfigured } from '@/server/db';
export const dynamic = 'force-dynamic';
export async function GET() {
  if (!databaseConfigured()) return Response.json({ status:'setup_required' },{status:503});
  try {
    const role = await db().query('SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user');
    if (role.rows[0].rolsuper || role.rows[0].rolbypassrls) throw new Error('Unsafe runtime role');
    const migration = await db().query("SELECT count(*)::int AS count FROM schema_migrations WHERE name=ANY($1::text[])",[['001_foundation','002_meta_connection','003_meta_range_insights','004_shopify_connection','005_meta_reports','006_google_ads','007_team_settings','008_shopify_customer_events','009_shopify_pixel_context','010_shopify_page_views','011_shopify_abandoned_checkouts','012_analyst_role','013_shopify_webhook_receipts','014_event_retention','015_webhook_event_deduplication','016_alert_rules']]);
    if (migration.rows[0].count!==16) throw new Error('Migration missing');
    return Response.json({status:'ready',scope:'application',schema:'016_alert_rules',integrations:'not_checked'},{headers:{'Cache-Control':'no-store'}});
  } catch { return Response.json({status:'unavailable'},{status:503}); }
}
