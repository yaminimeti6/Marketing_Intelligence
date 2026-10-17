'use client';
import ImportRefresh from './import-refresh';
import Link from 'next/link';
import { ShoppingBag } from 'lucide-react';
import type { ShopifyStatus } from '@/server/shopify';
import { requestShopifySync } from '@/app/integrations/shopify-actions';
const messages:Record<string,string>={authorized:'Shopify authorization and store identity verified. Commerce import has not yet completed.',invalid_state:'Authorization expired or belongs to another session/store. Start again.',session_required:'Sign in on the registered HTTPS callback domain before connecting.',authorization_denied:'Authorization was declined. No connection was created.',sync_queued:'Import queued. Waiting for the Shopify worker; no completion is claimed yet.',sync_failed:'Import could not be requested. Check store access and workspace permissions.',reauthorization_required:'Shopify authorization needs renewal. Reconnect.',permission_denied:'Required read permissions were not granted.'};
export default function ShopifyIntegration({status,notice}:{status?:ShopifyStatus;notice?:string}){
 const ready=!!status?.configured&&status.schemaReady&&status.canManage&&status.available;
 const connected=status?.stores.some(s=>s.status==='connected');
 return <section className="panel foundation-integration">
  <ImportRefresh active={!!status?.jobs.some(j=>j.status==='queued'||j.status==='running')}/>
  <div className="foundation-integration-heading"><span className="empty-symbol"><ShoppingBag size={25}/></span><span className="foundation-status">Priority 2 · Shopify</span></div>
  <h2>Shopify</h2><p>Read-only store authorization and order/product imports. Imported order subtotals and refunds are available after a completed import.</p>
  {notice&&notice!=='sync_queued'&&(notice!=='authorized'||connected)&&<div className="foundation-requirements" role="status">{messages[notice]??'Connection could not complete. No successful connection is claimed.'}</div>}
  {!status?.configured&&<p className="foundation-muted">Store address and developer app setup are pending. Existing Meta reporting remains available.</p>}
  {!status?.schemaReady&&<p className="foundation-muted">Shopify reporting storage is not ready yet.</p>}
  {status?.available===false&&<p role="alert">Shopify connection status is temporarily unavailable.</p>}
  <form method="post" action="/api/integrations/shopify/start"><button className="button primary" disabled={!ready}>{!status?.configured?'Configure Shopify app first':!status.schemaReady?'Apply Shopify migration first':!status.canManage?'Administrator access required':connected?'Reconnect Shopify':'Connect Shopify'}</button></form>
  <p className="foundation-muted">{connected?'Authorized store connection':'Not connected'} · Imported snapshots are separate from Shopify Analytics Net Sales.</p>
  {status?.stores.map(store=><div className="foundation-requirements" key={store.id}><strong>{store.name}</strong><p>{store.domain} · {store.status}</p><p>Last completed import: {store.lastSync?new Date(store.lastSync).toLocaleString():'Never'}</p><form action={requestShopifySync}><input type="hidden" name="connection" value={store.id}/><button className="button" disabled={!ready||store.status!=='connected'}>Queue order & product import</button></form></div>)}
  {!!status?.jobs.length&&<div className="foundation-requirements"><strong>Recent Shopify import jobs</strong>{status.jobs.map((j,i)=><p key={i}>{j.status}{j.code?` · ${j.code}`:''}</p>)}</div>}
  {connected&&<Link className="button" href="/shopify">View imported Shopify totals</Link>}
  <p className="foundation-muted">No storefront changes, product writes or test purchases. No demo data in imported records.</p>
 </section>;
}
