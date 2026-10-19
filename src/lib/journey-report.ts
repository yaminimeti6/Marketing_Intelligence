export type JourneyEvent={source:string;visitor:string;customer:string|null;name:string;channel:string;order:string|null;time:string};
export type MeasurementOrder={source:string;id:string;time:string};
const month=(time:string)=>time.slice(0,7),monthIndex=(m:string)=>Number(m.slice(0,4))*12+Number(m.slice(5,7))-1;
export function journeyReport(events:JourneyEvent[],orders:MeasurementOrder[],asOf=new Date().toISOString()){
 const ordered=[...events].filter(e=>Number.isFinite(Date.parse(e.time))&&e.time<=asOf).sort((a,b)=>a.time.localeCompare(b.time)||a.name.localeCompare(b.name));
 const uniqueOrders=[...new Map(orders.map(o=>[o.source+':'+o.id,o])).values()];
 const channels=new Map<string,{channel:string;first:number;last:number;linear:number}>();
 const credit=(channel:string,kind:'first'|'last'|'linear',amount:number)=>{const row=channels.get(channel)??{channel,first:0,last:0,linear:0};row[kind]+=amount;channels.set(channel,row);};
 let matched=0;const purchases:JourneyEvent[]=[];
 for(const order of uniqueOrders){
  const receipt=ordered.find(e=>e.source===order.source&&e.order===order.id&&e.name==='checkout_completed');
  if(!receipt){for(const kind of ['first','last','linear'] as const)credit('unattributed',kind,1);continue;}
  matched++;purchases.push(receipt);
  const touches=ordered.filter(e=>e.source===receipt.source&&e.visitor===receipt.visitor&&e.name==='page_viewed'&&e.time<=receipt.time&&Date.parse(e.time)>=Date.parse(receipt.time)-30*86400000);
  if(!touches.length){for(const kind of ['first','last','linear'] as const)credit('unattributed',kind,1);continue;}
  credit(touches[0].channel,'first',1);credit(touches.at(-1)!.channel,'last',1);for(const t of touches)credit(t.channel,'linear',1/touches.length);
 }
 const customers=new Map<string,JourneyEvent[]>();for(const e of purchases)if(e.customer){const key=e.source+':'+e.customer;customers.set(key,[...(customers.get(key)??[]),e]);}
 const cohorts=new Map<string,{month:string;customers:number;active:[number,number,number]}>();
 for(const purchaseEvents of customers.values()){
  purchaseEvents.sort((a,b)=>a.time.localeCompare(b.time));const first=month(purchaseEvents[0].time),cohort=cohorts.get(first)??{month:first,customers:0,active:[0,0,0]};cohort.customers++;
  const seen=new Set(purchaseEvents.map(e=>monthIndex(month(e.time))-monthIndex(first)));for(let i=0;i<3;i++)if(seen.has(i))cohort.active[i]++;cohorts.set(first,cohort);
 }
 const visitorKeys=[...new Set(ordered.map(e=>e.source+':'+e.visitor))];
 return {orders:uniqueOrders.length,matched,unmatched:uniqueOrders.length-matched,identifiedCustomers:customers.size,channels:[...channels.values()].sort((a,b)=>b.last-a.last),cohorts:[...cohorts.values()].sort((a,b)=>a.month.localeCompare(b.month)).map(c=>({...c,mature:c.active.map((_,i)=>monthIndex(c.month)+i<monthIndex(month(asOf)))})),journeys:visitorKeys.slice(-20).map((key,index)=>({label:'Observed visitor '+(index+1),events:ordered.filter(e=>e.source+':'+e.visitor===key).slice(-20).map(e=>({name:e.name,channel:e.channel,time:e.time,matchedOrder:!!e.order&&uniqueOrders.some(o=>o.source===e.source&&o.id===e.order)}))})),eventCount:ordered.length};
}
