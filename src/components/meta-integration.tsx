'use client';
import { Target } from 'lucide-react';
import type { MetaStatus } from '@/server/meta';
import { requestMetaSync } from '@/app/integrations/actions';

const messages:Record<string,string>={
  no_accessible_accounts:'Meta authorization succeeded. No accessible ad accounts were returned. No payment method, new Facebook account or ad spend is needed to keep developing.',
  accounts_discovered:'Meta authorization and real ad account discovery completed.',
  authorization_denied:'Meta authorization was declined. No connection was created.',
  invalid_state:'Authorization expired, was already used, or belongs to another session. Start a new connection.',
  session_required:'Sign in on the configured callback domain, then start Meta authorization again.',
  reauthorization_required:'Meta access expired or was revoked. Reconnect to authorize again.',
  permission_denied:'Required ads_read permission is missing or access was denied.',
  rate_limited:'Meta temporarily limited requests. Try again later.',
  unavailable:'Meta is temporarily unavailable. No successful sync is claimed.',
  sync_queued:'Selection saved and sync requested. A worker must complete the queued job before data is current.',
  sync_request_failed:'Sync could not be queued. Check workspace permissions and selected accounts.',
  selection_saved:'Selection saved. No accounts selected and no new sync jobs requested.',
};
export default function MetaIntegration({status,notice}:{status?:MetaStatus;notice?:string}) {
  const connected=status?.connections.some(c=>c.status==='connected')??false;
  const accounts=status?.accounts??[];
  const ready=!!status?.configured&&status.schemaReady&&status.canManage;
  const trustedNotice=notice&&(!['no_accessible_accounts','accounts_discovered'].includes(notice)||connected);
  return <section className="panel foundation-integration">
    <div className="foundation-integration-heading"><span className="empty-symbol"><Target size={25}/></span><span className="foundation-status">Priority 1 · Meta Ads</span></div>
    <h2>Meta Ads</h2><p>Real Meta OAuth, authorized account discovery and read-only Marketing API imports.</p>
    {trustedNotice&&<div className="foundation-requirements" role="status">{messages[notice]??'Connection could not finish. Check configuration and authorize again. No successful connection is claimed.'}</div>}
    {!status?.schemaReady&&<p className="foundation-muted">Meta database migration is pending. Existing login and foundation data remain available.</p>}
    {!status?.configured&&<p className="foundation-muted">Configure the real App ID, App Secret, confirmed Graph version and HTTPS callback privately before connecting.</p>}
    {status?.configured&&<p className="foundation-muted">Start authorization while signed in on the same HTTPS domain as the registered callback.</p>}
    <form method="post" action="/api/integrations/meta/start"><button className="button primary" disabled={!ready}>{!status?.configured?'Configure Meta app first':!status?.schemaReady?'Apply Meta migration first':!status.canManage?'Administrator access required':connected?'Reconnect Meta Ads':'Connect Meta Ads'}</button></form>
    <p className="foundation-muted">{connected?'Connected to Meta':status?.connections.some(c=>c.status==='reauthorization_required')?'Reauthorization required':'Not connected'} · {connected?`${accounts.length} accessible ad accounts`:'No live account connection'}</p>
    {connected&&!accounts.length&&<div className="foundation-requirements"><strong>Connected · No accessible ad accounts</strong><p>Meta returned an empty account list. Campaigns and Insights stay empty until this Facebook user is authorized for a real ad account. There is no need to add billing or spend money.</p></div>}
    {!!accounts.length&&<form action={requestMetaSync}><fieldset style={{border:0,padding:0,margin:'16px 0'}}><legend>Select ad accounts to synchronize</legend>{accounts.map(a=><label key={`${a.connectionId}:${a.id}`} style={{display:'flex',gap:8,alignItems:'center',margin:'12px 0',overflowWrap:'anywhere'}}><input type="checkbox" name="account" value={`${a.connectionId}:${a.id}`} defaultChecked={a.selected} disabled={!status?.canManage}/><span>{a.name} · {a.id} · {a.currency??'Currency unavailable'}<small style={{display:'block'}}>Last completed sync: {a.lastSync?new Date(a.lastSync).toLocaleString():'Never'}</small></span></label>)}</fieldset><button className="button" disabled={!status?.canManage}>Save selection & queue sync</button></form>}
    {!!status?.jobs.length&&<div className="foundation-requirements"><strong>Recent sync jobs</strong>{status.jobs.map((job,index)=><p key={index}>{job.status}{job.code?` · ${job.code}`:''}</p>)}</div>}
    <p className="foundation-muted">Real source only. Local demo screens remain separately labeled under Design Preview.</p>
  </section>;
}
