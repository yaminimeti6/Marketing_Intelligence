import {createHash} from 'node:crypto';
export const pixelEvents=['page_viewed','product_viewed','product_added_to_cart','checkout_started'] as const;
export function parsePixelEvent(value:unknown,now=Date.now()){
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('invalid');
 const input=value as Record<string,unknown>;
 if(Object.keys(input).some(key=>!['key','id','name','productId','quantity','timestamp'].includes(key)))throw new Error('invalid');
 const {key,id,name,productId,quantity,timestamp}=input;
 if(typeof key!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(key)||typeof id!=='string'||!/^[A-Za-z0-9_.:-]{1,128}$/.test(id)||typeof name!=='string'||!(pixelEvents as readonly string[]).includes(name)||!Number.isInteger(quantity)||Number(quantity)<1||Number(quantity)>1000||typeof timestamp!=='string'||!Number.isFinite(Date.parse(timestamp))||Date.parse(timestamp)<now-86400000||Date.parse(timestamp)>now+300000)throw new Error('invalid');
 if(productId!==null&&(typeof productId!=='string'||!/^gid:\/\/shopify\/Product\/[0-9]+$/.test(productId)))throw new Error('invalid');
 if(name!=='checkout_started'&&name!=='page_viewed'&&productId===null)throw new Error('invalid');
 const hash=(text:string)=>createHash('sha256').update(text).digest('hex');
 return {keyHash:hash(key),eventHash:hash(key+':'+id),name,productId,quantity:Number(quantity),timestamp:new Date(timestamp).toISOString()};
}
// This is browser code for Shopify's custom-pixel sandbox, not an Admin API token.
export function shopifyPixelCode(origin:string,key:string){
 const url=new URL(origin);if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||url.search||url.hash||!/^[A-Za-z0-9_-]{43}$/.test(key))throw new Error('invalid');
 return `// Northstar Analytics: consent-aware, aggregate behavioral events only.
// No customer names, emails, addresses, cookies or cart contents are transmitted.
(() => {
  const endpoint = ${JSON.stringify(url.origin+'/api/shopify/events')};
  const writeKey = ${JSON.stringify(key)};
  let privacy = init.customerPrivacy;
  api.customerPrivacy.subscribe('visitorConsentCollected', event => {
    privacy = event.customerPrivacy;
  });
  const productId = value => {
    if (typeof value !== 'string') return null;
    if (/^gid:\\/\\/shopify\\/Product\\/[0-9]+$/.test(value)) return value;
    return /^[0-9]+$/.test(value) ? 'gid://shopify/Product/' + value : null;
  };
  const send = (event, product, quantity) => {
    if (privacy?.analyticsProcessingAllowed !== true) return;
    const payload = {key: writeKey, id: event.id, name: event.name,
      timestamp: event.timestamp, productId: product, quantity};
    fetch(endpoint, {method: 'POST', credentials: 'omit',
      headers: {'Content-Type': 'text/plain;charset=UTF-8'},
      body: JSON.stringify(payload), keepalive: true}).catch(() => {});
  };
  analytics.subscribe('product_viewed', event => {
    const id = productId(event.data?.productVariant?.product?.id);
    if (id) send(event, id, 1);
  });
  analytics.subscribe('product_added_to_cart', event => {
    const line = event.data?.cartLine;
    const id = productId(line?.merchandise?.product?.id);
    if (id && Number.isInteger(line.quantity) && line.quantity > 0 && line.quantity <= 1000)
      send(event, id, line.quantity);
  });
  analytics.subscribe('page_viewed', event => send(event, null, 1));
  analytics.subscribe('checkout_started', event => send(event, null, 1));
})();
`;
}
