export type Experiment={id:string;name:string;kind:'headline'|'landing';entry:string;a:string;b:string;status:string;starts:string|null;ends:string|null};
export function experimentInput(form:FormData){
 const get=(k:string)=>String(form.get(k)??'').trim(),name=get('name'),kind=get('kind'),entry=get('entry'),a=get('a'),b=get('b');
 const path=(v:string)=>/^\/(?!\/)[a-zA-Z0-9/_-]*$/.test(v)&&v.length<=200;
 if(name.length<3||name.length>100||!['headline','landing'].includes(kind)||!path(entry)||!a||!b||a===b||a.length>300||b.length>300)throw Error('Choose a name, clean entry path and two different variants (max 300 characters).');
 if(kind==='landing'&&(!path(a)||!path(b)||a===entry||b===entry))throw Error('Landing variants must be different same-store paths, distinct from the entry path.');
 return {name,kind,entry,a,b};
}
export function experimentSnippet(e:Experiment){
 const safe=(v:unknown)=>JSON.stringify(v).replaceAll('<','\\u003c');
 return `<script>
// Install only on your entry page. Both Shopify analytics and marketing permission required.
(()=>{const id=${safe(e.id)},entry=${safe(e.entry)},kind=${safe(e.kind)},a=${safe(e.a)},b=${safe(e.b)},ends=${safe(e.ends)},starts=${safe(e.starts)};let exposed=false;
 const run=()=>{const p=window.Shopify?.customerPrivacy;if(!p?.analyticsProcessingAllowed?.()||!p?.marketingAllowed?.()){exposed=false;return;}if(exposed||location.pathname!==entry||!starts||!ends||Date.now()<Date.parse(starts)||Date.now()>Date.parse(ends))return;
  try{const key='northstar:experiment:'+id;let variant=localStorage.getItem(key);if(!['A','B'].includes(variant)){variant=(crypto.getRandomValues(new Uint8Array(1))[0]&1)?'B':'A';localStorage.setItem(key,variant);}const value=variant==='A'?a:b;
   if(kind==='headline'){const node=document.querySelector('[data-northstar-experiment="'+id+'"]');if(!node||node.getClientRects().length===0)return;node.textContent=value;}
   if(!window.Shopify?.analytics?.publish)return;exposed=true;Promise.resolve(Shopify.analytics.publish('northstar:exposure',{experiment:id,variant})).then(()=>{if(kind==='landing')location.assign(value+location.search);}).catch(()=>{exposed=false;});
  }catch{}
 };run();document.addEventListener('visitorConsentCollected',run);})();
</script>`;
}
export function experimentRates(a:number,ca:number,b:number,cb:number){
 const wilson=(n:number,k:number)=>{if(!n)return null;const z=1.95996398454,p=k/n,d=1+z*z/n,center=(p+z*z/(2*n))/d,half=z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n))/d;return {rate:p,low:Math.max(0,center-half),high:Math.min(1,center+half)};};
 if([a,ca,b,cb].some(n=>!Number.isSafeInteger(n)||n<0)||ca>a||cb>b)throw Error('invalid experiment counts');
 return {a:wilson(a,ca),b:wilson(b,cb),imbalance:a+b>=100&&Math.pow(a-b,2)/(a+b)>6.635};
}
