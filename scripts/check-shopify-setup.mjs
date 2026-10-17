import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { shopifyConfig } from '../src/lib/shopify-config.ts';
// Read-only. Deliberately prints neither values nor caught exception details.
let env;
try { env=parseEnv(readFileSync(new URL('../.env',import.meta.url),'utf8')); }
catch { console.error('Private .env unavailable. No values displayed.');process.exit(1); }
for(const name of ['SHOPIFY_SHOP_DOMAIN','SHOPIFY_CLIENT_ID','SHOPIFY_CLIENT_SECRET','SHOPIFY_API_VERSION','SHOPIFY_REDIRECT_URI'])console.log(`${name}: ${env[name]?.trim()?'present (value withheld)':'not configured'}`);
try { shopifyConfig(env);console.log('Local formats valid. No Shopify authorization, token verification or sync has been performed.'); }
catch { console.log('Shopify setup incomplete or invalid. Follow docs/shopify-setup.md. Existing Meta configuration is unchanged.');process.exitCode=1; }
