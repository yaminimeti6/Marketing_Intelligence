export type Platform = 'Meta';
export type Campaign = { id: string; name: string; platform: Platform; status: string; objective: string; budget: number; base: number; rate: number; cpc: number; conversion: number };
export const campaigns: Campaign[] = [
  { id:'meta-prospecting',name:'Prospecting · Broad audience',platform:'Meta',status:'Active',objective:'Sales',budget:500,base:480,rate:3.94,cpc:0.74,conversion:0.036 },
  { id:'meta-retargeting',name:'Retargeting · Website visitors',platform:'Meta',status:'Active',objective:'Sales',budget:200,base:185,rate:5.82,cpc:0.63,conversion:0.058 },
  { id:'meta-creative',name:'Creative testing · Autumn edit',platform:'Meta',status:'Paused',objective:'Sales',budget:150,base:95,rate:2.14,cpc:0.88,conversion:0.023 },
];
export const ANCHOR = '2026-10-15';
export function rangeFor(days:number) { const end=new Date(`${ANCHOR}T00:00:00Z`); const start=new Date(end);start.setUTCDate(start.getUTCDate()-days+1);return {start:start.toISOString().slice(0,10),end:ANCHOR}; }
export function getRows(start:string,end:string,platform='All',search='',status='All',campaignId='All') {
  const first=Date.parse(start+'T00:00:00Z'),last=Date.parse(end+'T00:00:00Z');
  if(!Number.isFinite(first)||!Number.isFinite(last)||first>last)return [];
  const days=Math.min(366,Math.floor((last-first)/86400000)+1);
  return campaigns.filter(c=>(platform==='All'||c.platform===platform)&&(status==='All'||c.status===status)&&(campaignId==='All'||c.id===campaignId)&&c.name.toLowerCase().includes(search.toLowerCase())).map(c=>{
    const daily=Array.from({length:days},(_,i)=>{const time=first+i*86400000;const n=Math.floor(time/86400000);const wave=1+0.22*Math.sin(n*0.7+c.base)+0.1*Math.cos(n*1.3);const spend=+(c.base*wave).toFixed(2);const clicks=Math.round(spend/c.cpc);const conversions=Math.round(clicks*c.conversion);return {date:new Date(time).toISOString().slice(0,10),spend,value:+(spend*c.rate*(1+0.08*Math.sin(n))).toFixed(2),clicks,impressions:Math.round(clicks/0.027),conversions};});
    const total=daily.reduce((a,d)=>({spend:a.spend+d.spend,value:a.value+d.value,clicks:a.clicks+d.clicks,impressions:a.impressions+d.impressions,conversions:a.conversions+d.conversions}),{spend:0,value:0,clicks:0,impressions:0,conversions:0});
    return {...c,...total,daily,roas:ratio(total.value,total.spend),ctr:ratio(total.clicks*100,total.impressions),actualCpc:ratio(total.spend,total.clicks),cpa:ratio(total.spend,total.conversions),cpm:ratio(total.spend*1000,total.impressions)};
  });
}
export function ratio(n:number,d:number){return d?n/d:null;}
export type Row=ReturnType<typeof getRows>[number];
export function sumRows(rows:Row[]) {return rows.reduce((a,r)=>({spend:a.spend+r.spend,value:a.value+r.value,clicks:a.clicks+r.clicks,impressions:a.impressions+r.impressions,conversions:a.conversions+r.conversions}),{spend:0,value:0,clicks:0,impressions:0,conversions:0});}
export function getTrend(rows:Row[]) {const dates=new Map<string,{date:string;spend:number;value:number;clicks:number;conversions:number}>();rows.forEach(r=>r.daily.forEach(d=>{const old=dates.get(d.date)||{date:d.date,spend:0,value:0,clicks:0,conversions:0};dates.set(d.date,{date:d.date,spend:old.spend+d.spend,value:old.value+d.value,clicks:old.clicks+d.clicks,conversions:old.conversions+d.conversions});}));return [...dates.values()].sort((a,b)=>a.date.localeCompare(b.date));}
export function commerce(start:string,end:string){const dates=getTrend(getRows(start,end));return dates.map((d,i)=>({...d,sales:+(d.spend*(3.8+0.3*Math.sin(i/3))).toFixed(2),orders:Math.round(d.spend*3.8/118)}));}
export function previousRange(start:string,end:string){const duration=Date.parse(end)-Date.parse(start)+86400000;return {start:new Date(Date.parse(start)-duration).toISOString().slice(0,10),end:new Date(Date.parse(start)-86400000).toISOString().slice(0,10)};}
export function csvCell(value:unknown){const text=String(value??'');return '"'+(/^[=+@\-\t\r]/.test(text)?"'"+text:text).replaceAll('"','""')+'"';}
export function makeCsv(rows:Row[],currency:string,metrics=['spend','value','roas']){const head=['DEMO DATA · not provider reporting',`Currency: ${currency}`];const columns=['Campaign','Platform','Status',...metrics];return head.map(csvCell).join(',')+'\r\n'+columns.map(csvCell).join(',')+'\r\n'+rows.map(r=>[r.name,r.platform,r.status,...metrics.map(m=>m==='spend'?r.spend:m==='value'?r.value:m==='clicks'?r.clicks:m==='conversions'?r.conversions:r.roas??'N/A')].map(csvCell).join(',')).join('\r\n');}
