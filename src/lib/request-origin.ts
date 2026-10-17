// Next may reconstruct request.url with localhost while the browser uses 127.0.0.1.
// Browser Host is authoritative; do not trust arbitrary X-Forwarded-Host values here.
export function sameOriginPost(request:Request){
 const raw=request.headers.get('origin');if(!raw||raw==='null')return false;
 try{const origin=new URL(raw);if(raw!==origin.origin)return false;
  const host=request.headers.get('host')??new URL(request.url).host;
  if(origin.host!==host)return false;
  return origin.protocol==='https:'||(origin.protocol==='http:'&&['127.0.0.1','localhost','[::1]'].includes(origin.hostname));
 }catch{return false;}
}
