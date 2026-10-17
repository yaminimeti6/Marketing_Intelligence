// Strict server configuration shared by the Shopify OAuth and import worker.
export const shopifyReadScopes = ['read_orders', 'read_products'] as const;
export function shopifyDomain(value:string):string {
  const domain=value.trim().toLowerCase();
  // Custom storefront domains, URL credentials, ports, paths and redirects are not API hosts.
  if(!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.myshopify\.com$/.test(domain))throw new Error('Invalid Shopify store domain.');
  return domain;
}
export type ShopifyConfig={clientId:string;clientSecret:string;version:string;redirectUri:string;shop:string};
export function shopifyConfig(env:Record<string,string|undefined>):ShopifyConfig {
  const clientId=env.SHOPIFY_CLIENT_ID?.trim(),clientSecret=env.SHOPIFY_CLIENT_SECRET?.trim();
  const version=env.SHOPIFY_API_VERSION?.trim(),redirectUri=env.SHOPIFY_REDIRECT_URI?.trim();
  if(!clientId||!clientSecret||!version||!/^\d{4}-(01|04|07|10)$/.test(version)||!redirectUri)throw new Error('Shopify configuration incomplete.');
  let uri:URL;try{uri=new URL(redirectUri);}catch{throw new Error('Invalid Shopify callback.');}
  if(uri.protocol!=='https:'||uri.username||uri.password||uri.search||uri.hash||uri.pathname!=='/api/integrations/shopify/callback')throw new Error('Invalid Shopify callback.');
  return {clientId,clientSecret,version,redirectUri,shop:shopifyDomain(env.SHOPIFY_SHOP_DOMAIN??'')};
}
