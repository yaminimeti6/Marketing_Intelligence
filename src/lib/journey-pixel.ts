import {createHash,createHmac} from 'node:crypto';
export function parseJourney(value:unknown,secret:string,now=Date.now()){
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('invalid');const x=value as Record<string,unknown>;
 if(Object.keys(x).some(k=>!['key','id','visitor','customer','name','channel','order','timestamp','analytics','marketing'].includes(k))||x.analytics!==true||x.marketing!==true)throw Error('consent');
 for(const k of ['key','id','visitor','name','channel','timestamp'])if(typeof x[k]!=='string')throw Error('invalid');
 if(!/^[\w-]{43}$/.test(x.key as string)||!/^[\w.:-]{1,128}$/.test(x.id as string)||!/^[\w.:-]{1,128}$/.test(x.visitor as string)||!['page_viewed','checkout_completed'].includes(x.name as string)||!['meta','organic','direct','other'].includes(x.channel as string))throw Error('invalid');
 const timestamp=Date.parse(x.timestamp as string);if(!Number.isFinite(timestamp)||timestamp<now-86400000||timestamp>now+300000)throw Error('invalid');
 if(x.name==='checkout_completed'){if(typeof x.order!=='string'||!/^gid:\/\/shopify\/Order\/\d+$/.test(x.order)||(x.customer!==null&&(typeof x.customer!=='string'||!/^gid:\/\/shopify\/Customer\/\d+$/.test(x.customer))))throw Error('invalid');}else if(x.order!==null||x.customer!==null)throw Error('invalid');
 const key=Buffer.from(secret,'base64');if(key.length!==32)throw Error('configuration');
 const hash=(v:string)=>createHmac('sha256',key).update(String(x.key)+':'+v).digest('hex');
 return {keyHash:createHash('sha256').update(x.key as string).digest('hex'),eventHash:hash('event:'+x.id),visitorHash:hash('visitor:'+x.visitor),customerHash:x.customer?hash('customer:'+x.customer):null,name:x.name,channel:x.channel,order:x.order,timestamp:new Date(timestamp).toISOString()};
}
export function journeyPixelCode(origin:string,key:string){
 const url=new URL(origin);if(url.protocol!=='https:'||url.origin!==origin||!/^[-\w]{43}$/.test(key))throw Error('invalid');
 return `// Northstar consent-based pseudonymous journey tracking. No names, emails or raw URLs.
(() => {
 let privacy=init.customerPrivacy;
 api.customerPrivacy.subscribe('visitorConsentCollected',event=>{privacy=event.customerPrivacy;});
 const gid=(type,value)=>typeof value==='string'&&/^\\d+$/.test(value)?'gid://shopify/'+type+'/'+value:typeof value==='string'&&new RegExp('^gid://shopify/'+type+'/[0-9]+$').test(value)?value:null;
 const send=event=>{
  if(privacy?.analyticsProcessingAllowed!==true||privacy?.marketingAllowed!==true||!event.clientId)return;
  let channel='direct';
  try{const source=new URL(event.context.document.location.href).searchParams.get('utm_source')?.toLowerCase();const ref=event.context.document.referrer?new URL(event.context.document.referrer).hostname:'';
   if(['facebook','instagram','meta','fb','ig'].includes(source))channel='meta';else if(source)channel='other';else if(/(^|\\.)(google|bing|duckduckgo)\\./.test(ref))channel='organic';else if(ref&&ref!==event.context.document.location.hostname)channel='other';
  }catch{}
  const order=event.name==='checkout_completed'?gid('Order',event.data?.checkout?.order?.id):null;
  if(event.name==='checkout_completed'&&!order)return;
  const customer=order?gid('Customer',event.data?.checkout?.order?.customer?.id):null;
  fetch(${JSON.stringify(origin+'/api/shopify/journeys')},{method:'POST',credentials:'omit',headers:{'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify({key:${JSON.stringify(key)},id:event.id,visitor:event.clientId,customer,name:event.name,channel,order,timestamp:event.timestamp,analytics:true,marketing:true}),keepalive:true}).catch(()=>{});
 };
 analytics.subscribe('page_viewed',send);analytics.subscribe('checkout_completed',send);
 analytics.subscribe('northstar:exposure',event=>{
  if(privacy?.analyticsProcessingAllowed!==true||privacy?.marketingAllowed!==true||!event.clientId)return;
  const experiment=event.customData?.experiment,variant=event.customData?.variant;
  if(typeof experiment!=='string'||!['A','B'].includes(variant))return;
  fetch(${JSON.stringify(origin+'/api/shopify/experiment-events')},{method:'POST',credentials:'omit',headers:{'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify({key:${JSON.stringify(key)},id:event.id,visitor:event.clientId,timestamp:event.timestamp,experiment,variant,analytics:true,marketing:true}),keepalive:true}).catch(()=>{});
 });
})();\n`;
}
