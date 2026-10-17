import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

// Read-only local configuration check. Never print environment values or call Meta.
let env;
try { env = parseEnv(readFileSync(new URL('../.env', import.meta.url), 'utf8')); }
catch { console.error('Private .env could not be read. No values displayed.'); process.exit(1); }
const required = ['META_APP_ID','META_APP_SECRET','META_GRAPH_API_VERSION','META_REDIRECT_URI'];
let ready = true;
for (const key of required) {
  const value = env[key]?.trim();
  let status = value ? 'present (not verified with Meta)' : 'missing';
  if (!value) ready = false;
  else if (key === 'META_APP_ID' && !/^\d+$/.test(value)) { status = 'invalid App ID format'; ready = false; }
  else if (key === 'META_GRAPH_API_VERSION' && !/^v\d+\.\d+$/.test(value)) { status = 'invalid version format'; ready = false; }
  else if (key === 'META_REDIRECT_URI') {
    try {
      const uri = new URL(value);
      if (uri.protocol !== 'https:' || uri.username || uri.password || uri.hash || uri.search || uri.pathname !== '/api/integrations/meta/callback') throw new Error();
    } catch { status = 'requires exact HTTPS callback ending /api/integrations/meta/callback'; ready = false; }
  }
  console.log(`${key}: ${status}`);
}
console.log(`META_LOGIN_CONFIG_ID: ${env.META_LOGIN_CONFIG_ID ? 'present (value withheld)' : 'not set; confirm the selected login flow before configuring'}`);
console.log(ready ? 'Local fields present. Provider authorization and live API verification are still required.' : 'Meta configuration incomplete. No connection, OAuth callback or sync is claimed.');
console.log('Read-only check complete. No secrets displayed or provider requests made.');
