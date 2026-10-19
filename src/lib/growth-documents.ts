export function publicTarget(value:unknown){if(typeof value!=='string'||value.length>1000)throw Error('target');const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||u.hostname==='localhost'||/^[\d.]+$/.test(u.hostname)||u.hostname.includes(':'))throw Error('target');return u.href;}
export function growthDefinition(kind:string,value:unknown){
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('input');const x=value as Record<string,unknown>;
 const text=(key:string,max:number,min=0)=>{const v=x[key];if(typeof v!=='string'||v.trim().length<min||v.length>max||/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(v))throw Error(key);return v.trim();};
 if(kind==='funnel')return {name:text('name',80,1),headline:text('headline',160,1),body:text('body',3000,1),cta:text('cta',60,1),target:publicTarget(x.target),theme:x.theme==='dark'?'dark':'light'};
 if(kind==='research'){const url=new URL(publicTarget(x.url));if(url.hostname!=='www.facebook.com'&&url.hostname!=='facebook.com')throw Error('research_url');if(url.pathname!=='/ads/library/'||!/^\d+$/.test(url.searchParams.get('id')??''))throw Error('research_ad');return {name:text('name',80,1),url:url.href,brand:text('brand',100,1),hook:text('hook',500),notes:text('notes',2000)};}
 throw Error('kind');
}
