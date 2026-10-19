import { createHmac } from 'node:crypto';

export type MetaConfig = { appId: string; appSecret: string; version: string; redirectUri: string; loginConfigId?: string };
export function metaConfig(env: Record<string, string | undefined>): MetaConfig {
  const appId = env.META_APP_ID?.trim(), appSecret = env.META_APP_SECRET?.trim();
  const version = env.META_GRAPH_API_VERSION?.trim(), redirectUri = env.META_REDIRECT_URI?.trim();
  if (!appId || !/^\d+$/.test(appId) || !appSecret || !version || !/^v\d+\.\d+$/.test(version) || !redirectUri) throw new MetaError('configuration');
  let uri: URL;
  try { uri = new URL(redirectUri); } catch { throw new MetaError('configuration'); }
  if (uri.protocol !== 'https:' || uri.username || uri.password || uri.search || uri.hash || uri.pathname !== '/api/integrations/meta/callback') throw new MetaError('configuration');
  const loginConfigId = env.META_LOGIN_CONFIG_ID?.trim() || undefined;
  if (loginConfigId && !/^\d+$/.test(loginConfigId)) throw new MetaError('configuration');
  return { appId, appSecret, version, redirectUri, loginConfigId };
}

export type MetaErrorKind = 'configuration' | 'reauthorization_required' | 'permission_denied' | 'rate_limited' | 'unavailable' | 'invalid_response';
export class MetaError extends Error {
  kind: MetaErrorKind;
  retryable: boolean;
  constructor(kind: MetaErrorKind) {
    super(`Meta integration: ${kind}`); this.name = 'MetaError'; this.kind = kind;
    this.retryable = kind === 'rate_limited' || kind === 'unavailable';
  }
}
export function oauthUrl(config: MetaConfig, state: string,management=false) {
  const url = new URL(`https://www.facebook.com/${config.version}/dialog/oauth`);
  url.searchParams.set('client_id', config.appId);
  url.searchParams.set('redirect_uri', config.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('state', state);
  if (config.loginConfigId) url.searchParams.set('config_id', config.loginConfigId);
  else url.searchParams.set('scope', management?'ads_read,ads_management':'ads_read');
  return url.toString();
}

export type AdAccount = { id: string; account_id: string; name: string; currency?: string; timezone_name?: string; account_status?: number };
export type MetaEntity = { id: string; name: string; status?: string; effective_status?: string; campaign_id?: string; adset_id?: string; daily_budget?: string; lifetime_budget?: string };
export type MetaInsight = { date_start: string; date_stop: string; account_id?: string; campaign_id?: string; adset_id?: string; ad_id?: string; spend?: string; impressions?: string; reach?: string; clicks?: string; actions?: {action_type:string;value:string}[]; action_values?: {action_type:string;value:string}[]; purchase_roas?: {action_type:string;value:string}[] };
type Json = Record<string, unknown>;
type Transport = typeof fetch;
export class MetaClient {
  private config: MetaConfig;
  private token: string;
  private transport: Transport;
  constructor(config: MetaConfig, token = '', transport: Transport = fetch) { this.config = config; this.token = token; this.transport = transport; }

  private async request(path: string, params: Record<string,string>, post = false, bearer = this.token): Promise<Json> {
    if (!/^(?:oauth\/access_token|debug_token|me(?:\/(?:permissions|adaccounts))?|(?:act_)?\d+(?:\/(?:campaigns|adsets|ads|insights))?)$/.test(path)) throw new MetaError('configuration');
    const url = new URL(`https://graph.facebook.com/${this.config.version}/${path}`);
    const values = new URLSearchParams(params);
    if (bearer && path !== 'debug_token' && path !== 'oauth/access_token') values.set('appsecret_proof', createHmac('sha256',this.config.appSecret).update(bearer).digest('hex'));
    if (!post) url.search = values.toString();
    let response: Response;
    try {
      response = await this.transport(url, {
        method: post ? 'POST' : 'GET', headers: { ...(bearer ? {Authorization:`Bearer ${bearer}`} : {}), ...(post ? {'Content-Type':'application/x-www-form-urlencoded'} : {}) },
        ...(post ? {body:values.toString()} : {}), cache:'no-store', redirect:'error', signal:AbortSignal.timeout(20000),
      });
    } catch { throw new MetaError('unavailable'); }
    let json: Json;
    try { json = await response.json(); if (!json || typeof json !== 'object' || Array.isArray(json)) throw new Error(); }
    catch { throw new MetaError('invalid_response'); }
    if (!response.ok || json.error) {
      const error = json.error as {code?:number;is_transient?:boolean} | undefined;
      if (error?.code === 190 || error?.code === 102) throw new MetaError('reauthorization_required');
      if (response.status === 429 || [4,17,32,613,80004].includes(error?.code ?? 0)) throw new MetaError('rate_limited');
      if (error?.code === 10 || error?.code === 200 || response.status === 403) throw new MetaError('permission_denied');
      throw new MetaError(response.status >= 500 || error?.is_transient ? 'unavailable' : 'invalid_response');
    }
    return json;
  }

  async exchangeCode(code: string) {
    const short = await this.request('oauth/access_token',{client_id:this.config.appId,client_secret:this.config.appSecret,redirect_uri:this.config.redirectUri,code},true,'');
    if (typeof short.access_token !== 'string') throw new MetaError('invalid_response');
    const long = await this.request('oauth/access_token',{grant_type:'fb_exchange_token',client_id:this.config.appId,client_secret:this.config.appSecret,fb_exchange_token:short.access_token},true,'');
    if (typeof long.access_token !== 'string') throw new MetaError('invalid_response');
    return long.access_token;
  }

  async validateToken() {
    const response = await this.request('debug_token',{input_token:this.token},false,`${this.config.appId}|${this.config.appSecret}`);
    const data = response.data as {is_valid?:boolean;app_id?:string;user_id?:string;scopes?:string[];expires_at?:number;data_access_expires_at?:number} | undefined;
    if (!data?.is_valid || String(data.app_id) !== this.config.appId || !data.user_id || !/^\d+$/.test(data.user_id)) throw new MetaError('reauthorization_required');
    if (!Array.isArray(data.scopes) || !data.scopes.includes('ads_read')) throw new MetaError('permission_denied');
    const expiries = [data.expires_at, data.data_access_expires_at].filter((n):n is number => typeof n === 'number' && n > 0);
    const expiry = expiries.length ? Math.min(...expiries) : null;
    if (expiry && expiry * 1000 <= Date.now()) throw new MetaError('reauthorization_required');
    return { userId:data.user_id, scopes:data.scopes, expiresAt:expiry ? new Date(expiry*1000) : null };
  }

  async *pages<T>(path: string, params: Record<string,string> = {}): AsyncGenerator<T[]> {
    let after: string | undefined;
    const seen = new Set<string>();
    for (let page = 0; page < 10000; page++) {
      const response = await this.request(path,{...params,limit:'100',...(after ? {after} : {})});
      if (!Array.isArray(response.data)) throw new MetaError('invalid_response');
      yield response.data as T[];
      const paging = response.paging as {next?:string;cursors?:{after?:string}} | undefined;
      if (!paging?.next) return;
      // Never follow a provider-supplied URL: it can contain tokens or another host.
      after = paging.cursors?.after;
      if (!after || seen.has(after)) throw new MetaError('invalid_response');
      seen.add(after);
    }
    throw new MetaError('invalid_response');
  }

  accounts() { return this.pages<AdAccount>('me/adaccounts',{fields:'id,account_id,name,currency,timezone_name,account_status'}); }
  entities(account: string, level: 'campaigns'|'adsets'|'ads') {
    const id = account.replace(/^act_/,''); if (!/^\d+$/.test(id)) throw new MetaError('configuration');
    const fields = level==='campaigns' ? 'id,name,status,effective_status,daily_budget,lifetime_budget' : level==='adsets' ? 'id,name,campaign_id,status,effective_status,daily_budget,lifetime_budget' : 'id,name,campaign_id,adset_id,status,effective_status';
    return this.pages<MetaEntity>(`act_${id}/${level}`,{fields});
  }
  insights(account:string, level:'account'|'campaign'|'adset'|'ad', since:string, until:string, daily=true) {
    const id=account.replace(/^act_/,'');
    const validDate=(v:string)=>{try{return /^\d{4}-\d{2}-\d{2}$/.test(v)&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;}catch{return false;}};
    if(!/^\d+$/.test(id)||!validDate(since)||!validDate(until)||since>until)throw new MetaError('configuration');
    const ids=level==='account'?'account_id':level==='campaign'?'account_id,campaign_id':level==='adset'?'account_id,campaign_id,adset_id':'account_id,campaign_id,adset_id,ad_id';
    return this.pages<MetaInsight>(`act_${id}/insights`,{level,time_range:JSON.stringify({since,until}),...(daily?{time_increment:'1'}:{}),use_account_attribution_setting:'true',fields:ids+',date_start,date_stop,spend,impressions,reach,clicks,actions,action_values,purchase_roas'});
  }
}
