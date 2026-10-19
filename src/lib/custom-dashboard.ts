import type {CombinedOverview} from './combined-overview.ts';
export const dashboardRegistry={spend:{label:'Meta ad spend',kind:'card'},revenue:{label:'Meta attributed revenue',kind:'card'},purchases:{label:'Meta purchase conversions',kind:'card'},roas:{label:'Meta ROAS',kind:'card'},sales:{label:'Shopify Net Sales',kind:'card'},mer:{label:'Blended MER',kind:'card'},trend:{label:'Meta daily spend',kind:'trend'},campaigns:{label:'Top Meta campaigns by spend',kind:'table'}} as const;
export type WidgetKey=keyof typeof dashboardRegistry;
export type DashboardDefinition={name:string;days:7|28;columns:2|3;scope:string;account:string;store:string;widgets:{key:WidgetKey;wide:boolean}[]};
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export function dashboardDefinition(value:unknown):DashboardDefinition{
 if(!value||typeof value!=='object')throw Error('dashboard_input');const x=value as DashboardDefinition;
 if(typeof x.name!=='string'||!x.name.trim()||x.name.trim().length>80||/[\x00-\x1f\x7f]/.test(x.name)||![7,28].includes(x.days)||![2,3].includes(x.columns)||typeof x.scope!=='string'||(x.scope!==''&&!/^[A-Z]{3}\|[^|]{1,100}$/.test(x.scope))||typeof x.account!=='string'||(x.account!=='all'&&!/^[a-f0-9-]{36}:\d+$/.test(x.account))||typeof x.store!=='string'||(x.store!==''&&!uuid.test(x.store))||!Array.isArray(x.widgets)||!x.widgets.length||x.widgets.length>8)throw Error('dashboard_input');
 if(x.scope)try{new Intl.DateTimeFormat('en',{timeZone:x.scope.split('|')[1]});}catch{throw Error('dashboard_timezone');}
 const seen=new Set<string>();const widgets=x.widgets.map(w=>{if(!w||!Object.hasOwn(dashboardRegistry,w.key)||typeof w.wide!=='boolean'||seen.has(w.key))throw Error('dashboard_widget');seen.add(w.key);return {key:w.key,wide:w.wide};});
 return {name:x.name.trim(),days:x.days,columns:x.columns,scope:x.scope,account:x.account,store:x.store,widgets};
}
export function dashboardMetric(key:WidgetKey,r:CombinedOverview,now=Date.now()){
 const last=Date.parse(r.meta.lastSync??''),metaReady=!r.dateError&&r.meta.ready&&!r.meta.error&&r.meta.accounts>0&&Number.isFinite(last)&&now-last<=900000&&last<=now+60000;
 const salesReady=!r.dateError&&!r.storeError&&r.shopify.netSales!==null;
 if(key==='sales')return {value:salesReady?r.shopify.netSales:null,currency:r.shopify.currency,unit:'money',note:'Shopify sales-event dates; excludes tax and customer shipping.'};
 if(key==='mer')return {value:metaReady&&salesReady&&r.compatible&&r.mer!==null?String(r.mer):null,currency:null,unit:'ratio',note:r.ratioReason};
 return {value:metaReady?key==='spend'?r.meta.spend:key==='revenue'?r.meta.revenue:key==='purchases'?r.meta.purchases:key==='roas'&&r.meta.roas!==null?String(r.meta.roas):null:null,currency:r.meta.currency,unit:key==='roas'?'ratio':key==='purchases'?'count':'money',note:metaReady?'Meta attribution settings; revenue is separate from Shopify sales.':'Complete covered Meta imports within the last 15 minutes are required.'};
}
