import {emailConfiguration} from '../src/lib/email-delivery.ts';
const env=process.env,config=emailConfiguration(env);
for(const name of ['RESEND_API_KEY','EMAIL_FROM','APP_URL'])console.log(`${name}: ${env[name]?.trim()?'present (value withheld)':'missing'}`);
console.log(`API key format: ${/^re_[A-Za-z0-9_-]+$/.test(env.RESEND_API_KEY?.trim()||'')?'valid prefix/characters; authentication not checked':'invalid or missing'}`);
if(!config){console.log('Email configuration incomplete or invalid. See docs/email-delivery.md.');process.exitCode=1;}
else console.log(config.from==='onboarding@resend.dev'?'Testing sender: only the Resend account email is an allowed recipient. Existing workspace members cannot be invited again.':'Custom sender: verify this exact sender domain in Resend before sending.');
console.log('Read-only local check: no email sent or provider contacted; inbox delivery, DNS and network access are not verified.');
