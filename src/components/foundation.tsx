'use client';
import CustomDashboard from './custom-dashboard';
import type {CustomDashboardPage} from '@/server/custom-dashboard';
import ScheduledReports from './scheduled-reports';
import type {ScheduledReportsPage} from '@/server/scheduled-reports';
import ActualProfit from './actual-profit';
import type {ActualProfitPage} from '@/server/actual-profit';
import MetaOperations from './meta-operations';
import type {MetaOperationsPage} from '@/server/meta-operations';
import Experiments from './experiments';
import type {ExperimentsPage} from '@/server/experiments';
import JourneyDashboard from './journey-report';
import type {JourneyPage} from '@/server/journey-report';
import AiImageGenerator from './ai-image-generator';
import ProfitPlanner from './profit-planner';
import AiAssistant from './ai-assistant';
import CreativeInsights from './creative-insights';
import ConnectionSecurity from './connection-security';
import type {ConnectionSecurity as ConnectionStatus} from '@/server/connection-security';
import Link from 'next/link';
import RulesPanel from './rules-panel';
import type {RulesPage} from '@/server/rules';
import SourceHealthPanel from './source-health';
import type {SourceHealth} from '@/server/sync-health';
import AnalyticsDashboard from './analytics-dashboard';
import type {AnalyticsData} from '@/lib/analytics';
import { useState,useEffect,useRef } from 'react';
import { Activity, ArrowRight, Bell, BarChart3, CalendarDays, ChevronRight, CircleHelp, Database, Layers3, LayoutDashboard, Link2, Menu, Settings, ShieldCheck, ShoppingBag, Sparkles, Target, X } from 'lucide-react';
import { signOut } from '@/app/login/actions';
import type { MetaStatus } from '@/server/meta';
import MetaIntegration from './meta-integration';
import ShopifyIntegration from './shopify-integration';
import ShopifyDashboard from './shopify-dashboard';
import type { ShopifyReport } from '@/server/shopify-report';
import type { ShopifyStatus } from '@/server/shopify';
import MetaDashboard from './meta-dashboard';
import CombinedOverview from './combined-overview';
import type {CombinedOverview as CombinedReport} from '@/lib/combined-overview';
import SavedReports from './report-library';
import WorkspaceSettings from './team-settings';
import type { TeamSettings } from '@/server/team';
import type { ReportLibrary } from '@/server/reports';
import type { MetaReport } from '@/lib/meta-report';

type Identity = {name:string;workspace:string;role:string};
const navigation = [
  {path:'custom-dashboard',label:'Custom Dashboard',icon:LayoutDashboard},
  {path:'meta',label:'Meta Ads',icon:Target},
  {path:'campaigns',label:'Campaigns',icon:Layers3},
  {path:'ad-manager',label:'Campaign Actions',icon:Target},
  {path:'analytics',label:'Analytics',icon:BarChart3},
  {path:'creative-insights',label:'Creative Insights',icon:Sparkles},
  {path:'ai',label:'AI Assistant',icon:Sparkles},
  {path:'ai-images',label:'AI Images',icon:Sparkles},
  {path:'scheduled-reports',label:'Scheduled Reports',icon:CalendarDays},
  {path:'reports',label:'Reports',icon:BarChart3},
  {path:'alerts',label:'Rules & Alerts',icon:Bell},
  {path:'shopify',label:'Shopify Sales',icon:ShoppingBag},
  {path:'overview',label:'Combined Overview',icon:LayoutDashboard},
  {path:'profit-analytics',label:'Profit Analytics',icon:BarChart3},
  {path:'profit-planner',label:'Profit Planner',icon:BarChart3},
  {path:'measurement',label:'Journeys & Cohorts',icon:Activity},
  {path:'experiments',label:'A/B Experiments',icon:Layers3},
  {path:'integrations',label:'Integrations',icon:Link2},
  {path:'settings',label:'Workspace Settings',icon:Settings},
  {path:'onboarding',label:'Setup checklist',icon:ShieldCheck},
];
const titles:Record<string,string>={'custom-dashboard':'Custom Dashboard','scheduled-reports':'Scheduled Reports','profit-analytics':'Actual Profit Analytics','ad-manager':'Campaign Actions',experiments:'A/B Experiments',measurement:'Journeys & Cohorts','ai-images':'AI Images','profit-planner':'Profit Planner',ai:'AI Assistant','creative-insights':'Creative Insights',alerts:'Rules & Alerts',onboarding:'Setup checklist',meta:'Meta Ads',campaigns:'Campaigns',shopify:'Shopify Sales',overview:'Combined Overview',integrations:'Integrations',settings:'Workspace Settings',analytics:'Analytics',reports:'Reports',attribution:'Attribution'};
export function StatusBadge({children}:{children:React.ReactNode}) { return <span className="foundation-status">{children}</span>; }
export function MetricCard({label,source}:{label:string;source:string}) {return <section className="kpi"><div className="kpi-top">{label}<BarChart3 size={16}/></div><strong className="kpi-value" aria-label="Not available">—</strong><p className="foundation-muted">{source} · Not connected</p></section>;}
export function EmptyPanel({title,description,icon:Icon=Activity}:{title:string;description:string;icon?:typeof Activity}) {return <section className="panel foundation-empty"><span className="empty-symbol"><Icon size={26}/></span><h2>{title}</h2><p>{description}</p><Link className="button" href="/integrations">View integration requirements <ArrowRight size={15}/></Link></section>;}
export default function Foundation({page,customDashboard,scheduledReports,scheduledRun,actualProfit,metaOperations,experiments,journeys,session,meta:metaIntegration,metaNotice,report,reportNotice,shopifyStatus,shopifyNotice,reportLibrary,libraryNotice,teamSettings,teamNotice,shopifyReport,combinedReport,analyticsData,analyticsParams,connectionSecurity,connectionNotice,sourceHealth,rulesPage}: {customDashboard?:CustomDashboardPage;scheduledReports?:ScheduledReportsPage;scheduledRun?:string;actualProfit?:ActualProfitPage;metaOperations?:MetaOperationsPage;experiments?:ExperimentsPage;journeys?:JourneyPage;page:string;session:Identity|null;meta?:MetaStatus;metaNotice?:string;report?:MetaReport;reportNotice?:string;shopifyStatus?:ShopifyStatus;shopifyNotice?:string;reportLibrary?:ReportLibrary;libraryNotice?:string;teamSettings?:TeamSettings|null;teamNotice?:string;shopifyReport?:ShopifyReport;combinedReport?:CombinedReport;rulesPage?:RulesPage;sourceHealth?:SourceHealth[];connectionSecurity?:ConnectionStatus;connectionNotice?:string;analyticsData?:AnalyticsData;analyticsParams?:Record<string,string|undefined>}) {
  const [open,setOpen]=useState(false);const drawerRef=useRef<HTMLElement>(null),menuRef=useRef<HTMLButtonElement>(null);
  useEffect(()=>{
   if(!open)return;const before=document.body.style.overflow;document.body.style.overflow='hidden';
   const focusTimer=window.setTimeout(()=>drawerRef.current?.querySelector<HTMLButtonElement>('.foundation-close')?.focus({preventScroll:true}),window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:220);
   const onKey=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();setOpen(false);}if(event.key==='Tab'){const items=[...(drawerRef.current?.querySelectorAll<HTMLElement>('a[href],button:not(:disabled),input,select,summary')??[])].filter(el=>el.getClientRects().length>0);const first=items[0],last=items.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}};
   const onResize=()=>{if(window.innerWidth>=1024)setOpen(false);};document.addEventListener('keydown',onKey);window.addEventListener('resize',onResize);
   return()=>{window.clearTimeout(focusTimer);document.body.style.overflow=before;document.removeEventListener('keydown',onKey);window.removeEventListener('resize',onResize);menuRef.current?.focus();};
  },[open]);
  const title=titles[page];
  const meta=page==='meta';
  const shopify=page==='shopify';
  return <div className="foundation"><a className="skip-link" href="#main-content">Skip to content</a>{open && <button className="foundation-backdrop" aria-label="Close navigation" onClick={()=>setOpen(false)}/>}
    <aside ref={drawerRef} id="workspace-navigation" role={open?'dialog':undefined} aria-modal={open?true:undefined} aria-label="Workspace navigation" className={`sidebar foundation-sidebar ${open?'foundation-open':''}`}><Link className="brand" href="/meta"><span className="brand-symbol">✦</span><span>NORTHSTAR<small className="brand-sub">MARKETING INTELLIGENCE</small></span></Link><div className="workspace-card"><div className="store-avatar">{session?.workspace[0]??'N'}</div><div className="workspace-label"><strong>{session?.workspace??'Workspace setup'}</strong><small>{session?'Private workspace':'Not configured'}</small></div><button className="foundation-close" aria-label="Close navigation" onClick={()=>setOpen(false)}><X size={20}/></button></div><p className="nav-label">WORKSPACE</p><nav aria-label="Main navigation">{navigation.map(({path,label,icon:Icon})=><a key={path} href={`/${path}`} className={`nav-item ${page===path?'active':''}`} aria-current={page===path?'page':undefined} onClick={()=>setOpen(false)}><Icon size={18}/><span>{label}</span>{path==='meta'&&<span className="nav-phase">FIRST</span>}</a>)}</nav><div className="sidebar-bottom"><div className="preview-card"><div className="preview-icon"><ShieldCheck size={18}/></div><strong>Built on a secure foundation</strong><p>Meta Ads first. Real source data when integrations are available.</p><Link className="text-button" href="/integrations">Connection roadmap <ArrowRight size={14}/></Link></div><div className="foundation-user"><span className="avatar">{session?.name[0]??'—'}</span><span><strong>{session?.name??'Not signed in'}</strong><small>{session?.role??'Foundation preview'}</small></span>{session?<form action={signOut}><button className="text-button" type="submit">Sign out</button></form>:<Link href="/login">Sign in</Link>}</div></div></aside>
    <div className="main-shell" inert={open}><header className="topbar"><div className="breadcrumbs"><button ref={menuRef} aria-controls="workspace-navigation" className="foundation-menu icon-button" aria-label="Open navigation" aria-expanded={open} onClick={()=>setOpen(true)}><Menu size={22}/></button><span>Workspace</span><ChevronRight size={14}/><strong>{title}</strong></div><div className="topbar-actions"><StatusBadge>{page==='alerts'?'In-app alerts':page==='analytics'?'Advertising analytics':page==='shopify'?'Shopify reporting':page==='overview'?'Source comparison':page==='settings'?'Workspace access':page==='integrations'?'Connections':page==='onboarding'?'Workspace setup':'Meta reporting'}</StatusBadge><Link className="icon-button" href="/integrations" aria-label="Integration requirements"><CircleHelp size={19}/></Link></div></header>
    <main id="main-content"><div className="page-heading"><div><div className="eyebrow">{meta?'YOUR PRIMARY MARKETING CHANNEL':'NORTHSTAR WORKSPACE'}</div><h1>{title}</h1><p>{meta?'Your Meta advertising performance, in one focused workspace.':shopify?'Actual store sales, kept distinct from advertising attribution.':'A clear view of your marketing operations.'}</p></div><StatusBadge>{page==='integrations'?(sourceHealth?.some(s=>s.connected>0)?'Connected sources':'Connection setup'):page==='analytics'?'Meta analytics':page==='onboarding'?'Workspace setup':page==='alerts'?'Workspace alerts':page==='settings'?'Workspace access':page==='overview'?'Source comparison':page==='shopify'&&shopifyReport?.stores.some(s=>s.ready)?'Shopify imported snapshots':report?.accounts.length?'Meta source':'No live data'}</StatusBadge></div>
      {!report&&page!=='alerts'&&page!=='onboarding'&&page!=='analytics'&&page!=='settings'&&page!=='shopify'&&page!=='overview'&&<div className="foundation-notice" role="status"><ShieldCheck size={19}/><p>{session?'You are signed in.':'Authentication and database setup are required.'} {page==='integrations'?'Meta connection status is shown below. Reporting uses completed Meta imports. Shopify connection setup is shown below.':'Performance reporting awaits an authorized Meta ad account. No demo metrics appear here.'}</p></div>}
      {page==='custom-dashboard'?<CustomDashboard key={customDashboard?.id+':'+customDashboard?.revision} data={customDashboard}/>:page==='scheduled-reports'?<ScheduledReports data={scheduledReports} selectedRun={scheduledRun}/>:page==='profit-analytics'?<ActualProfit data={actualProfit}/>:page==='ad-manager'?<MetaOperations data={metaOperations}/>:page==='experiments'?<Experiments data={experiments}/>:page==='measurement'?<JourneyDashboard data={journeys}/>:page==='ai-images'?<AiImageGenerator/>:page==='profit-planner'?<ProfitPlanner/>:page==='ai'?<AiAssistant/>:page==='creative-insights'&&report?<CreativeInsights key={JSON.stringify(report.query)} report={report}/>:page==='alerts'?<RulesPanel page={rulesPage}/>:page==='onboarding'?<div className="combined-overview"><section className="panel shopify-block"><h2>1. Workspace & team</h2><p>Choose reporting preferences and invite people with the access they need.</p><Link className="button" href="/settings">Open workspace settings</Link></section><SourceHealthPanel sources={sourceHealth} onboarding/><section className="panel shopify-block"><h2>3. Review your reports</h2><p>Use completed imports in Analytics and compare source summaries in Combined Overview. Missing accounts and incomplete coverage remain labeled.</p><Link className="button" href="/analytics">Open Analytics</Link> <Link className="button" href="/overview">Open Combined Overview</Link></section></div>:page==='analytics'&&analyticsData?<AnalyticsDashboard key={JSON.stringify(analyticsParams)} data={analyticsData} params={analyticsParams??{}} library={reportLibrary}/>:report?<>{page==='reports'&&<SavedReports library={reportLibrary} report={report} notice={libraryNotice}/>}<MetaDashboard key={JSON.stringify(report.query)} report={report} exportReady={page==='reports'&&!!reportLibrary?.ready} destination={page==='campaigns'?'campaigns':page==='reports'?'reports':'meta'} notice={reportNotice}/></>:page==='overview'?<CombinedOverview report={combinedReport}/>:page==='shopify'?<ShopifyDashboard report={shopifyReport}/>:page==='integrations'?<><SourceHealthPanel sources={sourceHealth}/><ConnectionSecurity status={connectionSecurity} notice={connectionNotice}/><IntegrationCards meta={metaIntegration} notice={metaNotice} shopify={shopifyStatus} shopifyNotice={shopifyNotice}/></>:page==='settings'?<WorkspaceSettings settings={teamSettings??null} notice={teamNotice}/>:['reports','attribution','analytics'].includes(page)?<EmptyPanel title="Planned for a later milestone" description="This capability remains on the roadmap. No reporting or attribution results are available yet." icon={Sparkles}/>:<>
      <div className="foundation-filters"><span><Target size={16}/> {shopify?'No Shopify stores connected':'No Meta ad accounts connected'}</span><button className="button" disabled><CalendarDays size={15}/> Date range unavailable</button></div>
      <div className="kpi-grid">{(meta?['Meta Ad Spend','Impressions','Conversions','Meta ROAS']:shopify?['Shopify Net Sales','Orders','Refunds','Products']:['Total Meta Ad Spend','Shopify Net Sales','Orders','Blended MER']).map(label=><MetricCard key={label} label={label} source={label.includes('Shopify')||label==='Orders'||shopify?'Shopify':'Meta Ads'}/>)}</div>
      <div className="foundation-chart-grid"><EmptyPanel title={meta?'Performance starts with a real connection':shopify?'Your sales story will appear here':'Revenue vs Ad Spend'} description={meta?'Connect your authorized Meta ad accounts in the next integration milestone to unlock trends and comparisons.':'Charts will use synchronized source records. There are no sales or performance records to display.'}/><section className="panel foundation-readiness"><span className="eyebrow">PLATFORM READINESS</span><h2>One step at a time</h2><ol><li><span>01</span><div><strong>Foundation & access</strong><p>Application shell, identity and data boundaries</p></div><StatusBadge>Current</StatusBadge></li><li><span>02</span><div><strong>Meta Ads integration</strong><p>OAuth, ad accounts and synchronization</p></div></li><li><span>03</span><div><strong>Shopify & combined reporting</strong><p>Store sales and marketing efficiency</p></div></li></ol><Link className="text-button" href="/integrations">Review requirements <ArrowRight size={14}/></Link></section></div>
      {!shopify&&<section className="panel"><div className="panel-heading"><div><h2>Campaign performance</h2><p>Campaign → Ad Set → Ad · Real Meta records only</p></div><StatusBadge>Not connected</StatusBadge></div><div className="table-scroll"><table><thead><tr>{['Campaign','Status','Budget','Spend','Conversions','ROAS'].map(x=><th key={x}>{x}</th>)}</tr></thead><tbody><tr><td colSpan={6} className="foundation-table-empty">No campaign data. Meta synchronization has not been enabled.</td></tr></tbody></table></div></section>}
      <div className="foundation-provenance"><Database size={18}/><p><strong>Clear sources. Trustworthy reporting.</strong><br/>Meta-attributed revenue and actual Shopify Net Sales will be labeled separately. No estimates or demo values appear here.</p></div>
      </>}
      <footer className="footer"><span>Northstar · Marketing Intelligence</span><span>Meta first. Shopify second.</span></footer></main></div></div>;
}
function IntegrationCards({meta,notice,shopify,shopifyNotice}:{meta?:MetaStatus;notice?:string;shopify?:ShopifyStatus;shopifyNotice?:string}){return <><div className="foundation-integration-grid"><MetaIntegration status={meta} notice={notice}/><ShopifyIntegration status={shopify} notice={shopifyNotice}/></div><section className="panel foundation-settings"><h2>Integration security</h2><p className="foundation-muted">Provider credentials stay on the server, encrypted and workspace-bound. Meta and Shopify have separate worker queues. A successful store authorization does not imply a completed commerce import or reconciled sales totals.</p></section></>; }
