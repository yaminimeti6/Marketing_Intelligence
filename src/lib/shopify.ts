import '@shopify/shopify-api/adapters/web-api';
import { shopifyApi,ApiVersion,Session as ShopifySession } from '@shopify/shopify-api';
import { shopifyDomain,shopifyReadScopes,type ShopifyConfig } from './shopify-config.ts';
export { ShopifySession };
export type ShopifyErrorKind='configuration'|'permission_denied'|'reauthorization_required'|'rate_limited'|'unavailable'|'invalid_response';
export class ShopifyError extends Error {
  kind:ShopifyErrorKind;
  constructor(kind:ShopifyErrorKind){super(`Shopify ${kind}`);this.kind=kind;}
  get retryable(){return this.kind==='rate_limited'||this.kind==='unavailable';}
}
export function shopifySdk(config:ShopifyConfig){
  if(!Object.values(ApiVersion).includes(config.version as ApiVersion))throw new ShopifyError('configuration');
  return shopifyApi({apiKey:config.clientId,apiSecretKey:config.clientSecret,apiVersion:config.version as ApiVersion,hostName:new URL(config.redirectUri).host,hostScheme:'https',isEmbeddedApp:false,scopes:[...shopifyReadScopes,'read_reports'],logger:{log:()=>{}}});
}
export function validateShopifySession(session:ShopifySession,shop:string){
  if(session.isOnline||session.shop!==shop||!session.accessToken||!session.refreshToken||!session.expires||!session.refreshTokenExpires||!Number.isFinite(session.expires.getTime())||!Number.isFinite(session.refreshTokenExpires.getTime())||session.refreshTokenExpires.getTime()<=Date.now()||session.expires.getTime()<=Date.now())throw new ShopifyError('invalid_response');
  if(!session.isScopeIncluded([...shopifyReadScopes]))throw new ShopifyError('permission_denied');
}
export const shopQuery=`query NorthstarShop { shop { name myshopifyDomain currencyCode ianaTimezone } }`;
export const productsQuery=`query NorthstarProducts($after:String) { products(first:50,after:$after,sortKey:ID) { nodes { id title status updatedAt } pageInfo { hasNextPage endCursor } } }`;
// No customer identity, addresses, payment details or free-text order notes are requested.
const lineFields=`id title sku variantTitle quantity currentQuantity isGiftCard originalUnitPriceSet { shopMoney { amount currencyCode } } product { id } variant { id } priceAfterAllDiscountsBeforeTaxesSet { shopMoney { amount currencyCode } }`;
export const ordersQuery=`query NorthstarOrders($after:String,$query:String!) { orders(first:5,after:$after,sortKey:UPDATED_AT,query:$query) { nodes { id createdAt updatedAt processedAt test cancelledAt currencyCode taxesIncluded displayFinancialStatus originalTotalPriceSet { shopMoney { amount currencyCode } } currentShippingPriceSet { shopMoney { amount currencyCode } } currentTotalDiscountsSet { shopMoney { amount currencyCode } } currentTotalPriceSet { shopMoney { amount currencyCode } } totalReceivedSet { shopMoney { amount currencyCode } } netPaymentSet { shopMoney { amount currencyCode } } totalOutstandingSet { shopMoney { amount currencyCode } } totalRefundedShippingSet { shopMoney { amount currencyCode } } currentSubtotalPriceSet { shopMoney { amount currencyCode } } currentTotalTaxSet { shopMoney { amount currencyCode } } totalShippingPriceSet { shopMoney { amount currencyCode } } totalRefundedSet { shopMoney { amount currencyCode } } refunds { id createdAt totalRefundedSet { shopMoney { amount currencyCode } } } lineItems(first:10) { nodes { ${lineFields} } pageInfo { hasNextPage endCursor } } } pageInfo { hasNextPage endCursor } } }`;
export const orderLinesQuery=`query NorthstarOrderLines($id:ID!,$after:String) { order(id:$id) { updatedAt lineItems(first:100,after:$after) { nodes { ${lineFields} } pageInfo { hasNextPage endCursor } } } }`;
// Deliberately omit customer identities, addresses and bearer recovery URLs.
export const abandonedCheckoutsQuery=`query NorthstarAbandonedCheckouts($after:String,$query:String!) { abandonedCheckouts(first:50,after:$after,sortKey:CREATED_AT,query:$query) { nodes { id createdAt updatedAt completedAt totalPriceSet { shopMoney { amount currencyCode } } } pageInfo { hasNextPage endCursor } } }`;
export type AbandonedCheckout={id:string;createdAt:string;updatedAt:string;completedAt:string|null;amount:string|null;currency:string|null};
export type ShopIdentity={name:string;myshopifyDomain:string;currencyCode:string;ianaTimezone:string};
export class ShopifyClient {
  private config:ShopifyConfig;private token:string;private request:typeof fetch;
  constructor(config:ShopifyConfig,token:string,request:typeof fetch=fetch){this.config=config;this.token=token;this.request=request;}
  async query<T>(query:string,variables:Record<string,unknown>={}):Promise<T>{
    const shop=shopifyDomain(this.config.shop);let response:Response;
    try{response=await this.request(`https://${shop}/admin/api/${this.config.version}/graphql.json`,{method:'POST',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(30000),headers:{'Content-Type':'application/json','X-Shopify-Access-Token':this.token},body:JSON.stringify({query,variables})});}catch{throw new ShopifyError('unavailable');}
    if(response.status===401)throw new ShopifyError('reauthorization_required');
    if(response.status===403)throw new ShopifyError('permission_denied');
    if(response.status===429)throw new ShopifyError('rate_limited');
    if(!response.ok)throw new ShopifyError(response.status>=500?'unavailable':'invalid_response');
    if(response.headers.get('x-shopify-api-version')&&response.headers.get('x-shopify-api-version')!==this.config.version)throw new ShopifyError('configuration');
    let body:{data?:T;errors?:{extensions?:{code?:string}}[]};try{body=await response.json();}catch{throw new ShopifyError('invalid_response');}
    if(body.errors?.length){const codes=body.errors.map(e=>e.extensions?.code);throw new ShopifyError(codes.includes('THROTTLED')?'rate_limited':codes.includes('ACCESS_DENIED')?'permission_denied':'invalid_response');}
    if(!body.data)throw new ShopifyError('invalid_response');return body.data;
  }
  async identity(){const {shop}=await this.query<{shop:ShopIdentity}>(shopQuery);if(!shop||shop.myshopifyDomain!==this.config.shop||typeof shop.name!=='string'||!/^\w{3}$/.test(shop.currencyCode)||typeof shop.ianaTimezone!=='string')throw new ShopifyError('invalid_response');try{new Intl.DateTimeFormat('en',{timeZone:shop.ianaTimezone});}catch{throw new ShopifyError('invalid_response');}return shop;}
  async abandonedCheckouts(since:string,until:string):Promise<AbandonedCheckout[]>{
    let after:string|null=null;const cursors=new Set<string>(),ids=new Set<string>(),rows:AbandonedCheckout[]=[];
    for(let page=0;page<200;page++){
      const data:Record<string,{nodes:Record<string,unknown>[];pageInfo:{hasNextPage:boolean;endCursor:string|null}}>=await this.query(abandonedCheckoutsQuery,{after,query:`created_at:>=${since} created_at:<=${until}`});
      const edge=data.abandonedCheckouts;
      if(!edge||!Array.isArray(edge.nodes)||typeof edge.pageInfo?.hasNextPage!=='boolean')throw new ShopifyError('invalid_response');
      for(const row of edge.nodes){
        const date=(value:unknown)=>typeof value==='string'&&Number.isFinite(Date.parse(value));
        if(typeof row.id!=='string'||!/^gid:\/\/shopify\/AbandonedCheckout\/[0-9]+$/.test(row.id)||ids.has(row.id)||!date(row.createdAt)||!date(row.updatedAt)||(row.completedAt!==null&&!date(row.completedAt)))throw new ShopifyError('invalid_response');
        if(Date.parse(String(row.createdAt))<Date.parse(since)||Date.parse(String(row.createdAt))>Date.parse(until))throw new ShopifyError('invalid_response');
        const price=(row.totalPriceSet as {shopMoney?:{amount?:unknown;currencyCode?:unknown}})?.shopMoney;
        const amount=typeof price?.amount==='string'&&/^\d{1,24}(\.\d{1,6})?$/.test(price.amount)?price.amount:null;
        const currency=typeof price?.currencyCode==='string'&&/^[A-Z]{3}$/.test(price.currencyCode)?price.currencyCode:null;
        ids.add(row.id);rows.push({id:row.id,createdAt:String(row.createdAt),updatedAt:String(row.updatedAt),completedAt:row.completedAt===null?null:String(row.completedAt),amount,currency});
      }
      if(!edge.pageInfo.hasNextPage)return rows;
      const next=edge.pageInfo.endCursor;if(!next||cursors.has(next))throw new ShopifyError('invalid_response');cursors.add(next);after=next;
    }throw new ShopifyError('invalid_response');
  }
  private async completeOrderLines(row:Record<string,unknown>):Promise<Record<string,unknown>>{
    type Edge={nodes:Record<string,unknown>[];pageInfo:{hasNextPage:boolean;endCursor:string|null}};
    let edge=row.lineItems as Edge;const nodes:Record<string,unknown>[]=[],cursors=new Set<string>(),ids=new Set<string>();
    for(let page=0;page<100;page++){
      if(!edge||!Array.isArray(edge.nodes)||typeof edge.pageInfo?.hasNextPage!=='boolean')throw new ShopifyError('invalid_response');
      for(const node of edge.nodes){
        if(typeof node.id!=='string'||!/^gid:\/\/shopify\/LineItem\/[0-9]+$/.test(node.id)||ids.has(node.id)||!Number.isSafeInteger(node.quantity)||!Number.isSafeInteger(node.currentQuantity)||Number(node.currentQuantity)<0||Number(node.quantity)<Number(node.currentQuantity))throw new ShopifyError('invalid_response');
        ids.add(node.id);nodes.push(node);
      }
      if(!edge.pageInfo.hasNextPage)return {...row,lineItems:{nodes,pageInfo:{hasNextPage:false,endCursor:null}},lineItemsComplete:true};
      const after=edge.pageInfo.endCursor;if(!after||cursors.has(after))throw new ShopifyError('invalid_response');cursors.add(after);
      const next=await this.query<{order:{updatedAt:string;lineItems:Edge}|null}>(orderLinesQuery,{id:row.id,after});
      if(!next.order||next.order.updatedAt!==row.updatedAt)throw new ShopifyError('unavailable');
      edge=next.order.lineItems;
    }throw new ShopifyError('invalid_response');
  }
  async *records(resource:'orders'|'products',since:string,until:string){
    let after:string|null=null;const seen=new Set<string>();
    for(let page=0;page<200;page++){
      const data:Record<string,{nodes:Record<string,unknown>[];pageInfo:{hasNextPage:boolean;endCursor:string|null}}>=await this.query<Record<string,{nodes:Record<string,unknown>[];pageInfo:{hasNextPage:boolean;endCursor:string|null}}>>(resource==='orders'?ordersQuery:productsQuery,{after,...(resource==='orders'?{query:`updated_at:>=${since} updated_at:<=${until}`}:{})});
      const edge=data[resource];if(!edge||!Array.isArray(edge.nodes)||!edge.pageInfo||typeof edge.pageInfo.hasNextPage!=='boolean'||edge.nodes.some(n=>!n||typeof n.id!=='string'||!new RegExp(`^gid://shopify/${resource==='orders'?'Order':'Product'}/[0-9]+$`).test(n.id)))throw new ShopifyError('invalid_response');
      const nodes=[];for(const row of edge.nodes)nodes.push(resource==='orders'?await this.completeOrderLines(row):row);
      yield nodes;if(!edge.pageInfo.hasNextPage)return;
      const next:string|null=edge.pageInfo.endCursor;if(!next||seen.has(next))throw new ShopifyError('invalid_response');seen.add(next);after=next;
    }throw new ShopifyError('invalid_response');
  }
}
