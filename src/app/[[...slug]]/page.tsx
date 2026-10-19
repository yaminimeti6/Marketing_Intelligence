import {loadCustomDashboard} from '@/server/custom-dashboard';
import {loadScheduledReports} from '@/server/scheduled-reports';
import {loadActualProfit} from '@/server/actual-profit';
import {loadMetaOperations} from '@/server/meta-operations';
import {loadExperiments} from '@/server/experiments';
import {loadJourneyReport} from '@/server/journey-report';
import {loadRules} from '@/server/rules';
import {loadSyncHealth} from '@/server/sync-health';
import {loadConnectionSecurity} from '@/server/connection-security';
import {loadAnalytics} from '@/server/analytics';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { loadShopifyReport } from '@/server/shopify-report';
import {loadCombinedOverview} from '@/server/combined-overview';
import Foundation from '@/components/foundation';
import { databaseConfigured } from '@/server/db';
import { requireSession } from '@/server/auth';
import { metaStatus } from '@/server/meta';
import { shopifyStatus } from '@/server/shopify';
import { loadMetaReport } from '@/server/meta-report';
import { reportLibrary } from '@/server/reports';
import { loadTeamSettings } from '@/server/team';
const routes = ['meta', 'overview', 'analytics', 'campaigns', 'shopify', 'attribution', 'reports', 'integrations', 'settings','onboarding','alerts','creative-insights','ai','profit-planner','ai-images','measurement','experiments','ad-manager','profit-analytics','scheduled-reports','custom-dashboard'];
export default async function Page({ params,searchParams }: { params: Promise<{ slug?: string[] }>;searchParams:Promise<Record<string,string|string[]|undefined>> }) {
  // Hosting secrets may exist only at runtime. Never prerender the setup branch
  // while building without DATABASE_URL and then serve it to signed-in users.
  await connection();
  const { slug } = await params;
  if (slug && (slug.length !== 1 || !routes.includes(slug[0]))) notFound();
  const session = databaseConfigured() ? await requireSession() : null;
  const page=slug?.[0]||'meta';
  const integration=page==='integrations'?await metaStatus(session):undefined;
  const shopify=page==='integrations'?await shopifyStatus(session):undefined;
  const raw=await searchParams;
  const query=Object.fromEntries(Object.entries(raw).map(([k,v])=>[k,typeof v==='string'?v:undefined]));
  const notice=query.meta;
  const customDashboard=page==='custom-dashboard'?await loadCustomDashboard(session,query.id):undefined;
  const scheduledReports=page==='scheduled-reports'?await loadScheduledReports(session,query.run):undefined;
  const actualProfit=page==='profit-analytics'?await loadActualProfit(session,query):undefined;
  const journeys=page==='measurement'?await loadJourneyReport(session):undefined;
  const experiments=page==='experiments'?await loadExperiments(session):undefined;
  const metaOperations=page==='ad-manager'?await loadMetaOperations(session):undefined;
  const report=['meta','campaigns','reports','creative-insights'].includes(page)?await loadMetaReport(session,page==='creative-insights'?{...query,level:'ads',compare:'true'}:query):undefined;
  const library=['reports','analytics'].includes(page)?await reportLibrary(session):undefined;
  const team=page==='settings'?await loadTeamSettings(session):undefined;
  const shopifyReport=page==='shopify'?await loadShopifyReport(session,query):undefined;
  const combinedReport=page==='overview'?await loadCombinedOverview(session,query):undefined;
  const connectionSecurity=page==='integrations'?await loadConnectionSecurity(session):undefined;
  let sourceHealth;
  if(['integrations','onboarding'].includes(page))try{sourceHealth=await loadSyncHealth(session);}catch{}
  const rulesPage=page==='alerts'?await loadRules(session):undefined;
  const analyticsData=page==='analytics'?await loadAnalytics(session,query):undefined;
  return <Foundation customDashboard={customDashboard} scheduledReports={scheduledReports} scheduledRun={query.run} actualProfit={actualProfit} metaOperations={metaOperations} experiments={experiments} journeys={journeys} rulesPage={rulesPage} sourceHealth={sourceHealth} connectionSecurity={connectionSecurity} connectionNotice={query.connection_notice} analyticsData={analyticsData} analyticsParams={query} combinedReport={combinedReport} shopifyReport={shopifyReport} teamSettings={team} teamNotice={query.team_notice} reportLibrary={library} libraryNotice={query.report_notice} shopifyStatus={shopify} shopifyNotice={query.shopify} report={report} reportNotice={query.notice} page={page} meta={integration} metaNotice={notice} session={session ? {name:session.name,workspace:session.workspace,role:session.role}:null} />;
}
