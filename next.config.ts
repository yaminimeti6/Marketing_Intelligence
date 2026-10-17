import type { NextConfig } from 'next';
const developmentOrigins:string[]=[];
try{const url=new URL(process.env.APP_URL??'');if(url.protocol==='https:')developmentOrigins.push(url.hostname);}catch{}
const config: NextConfig = {
  allowedDevOrigins: developmentOrigins,
  // OAuth callback query strings contain short-lived codes. Do not log them.
  logging: false,
  async headers() {
    return [{source:'/:path*',headers:[
      {key:'X-Content-Type-Options',value:'nosniff'},
      {key:'Referrer-Policy',value:'strict-origin-when-cross-origin'},
      {key:'X-Frame-Options',value:'DENY'},
      {key:'Permissions-Policy',value:'camera=(), microphone=(), geolocation=()'},
    ]},{source:'/invite',headers:[{key:'Referrer-Policy',value:'no-referrer'},{key:'Cache-Control',value:'private, no-store'}]}];
  },
};
export default config;
