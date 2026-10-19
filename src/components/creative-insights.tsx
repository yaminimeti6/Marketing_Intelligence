'use client';
import {useState} from 'react';
import {creativeInsights} from '@/lib/creative-insights';
import {formatMoney,formatDecimal,accountScope,type MetaReport,type Metrics} from '@/lib/meta-report';

export default function CreativeInsights({report}:{report:MetaReport}) {
 const [search,setSearch]=useState(''),[first,setFirst]=useState(''),[second,setSecond]=useState('');
 const rows=creativeInsights(report),key=(row:typeof rows[number])=>row.entity.accountKey+':'+row.entity.id;
 const a=rows.find(r=>key(r)===first),b=rows.find(r=>key(r)===second);
 const labels:Record<string,string>={coverage_missing:'Sync selected and previous periods',insufficient_evidence:'Insufficient evidence',review_fatigue:'Review possible fatigue',no_signal:'No fatigue signal'};
 const fmt=(value:number|null,suffix='')=>value===null?'—':value.toFixed(2)+suffix;
 const metric=(m:Metrics,k:keyof Metrics,currency:string|null)=>k==='ctr'?fmt(m.ctr,'%'):k==='roas'?fmt(m.roas,'×'):k==='cpa'?formatMoney(m.cpa===null?null:String(m.cpa),currency):k==='spend'?formatMoney(m.spend,currency):formatDecimal(m[k] as string|null,2);
 return <div className="creative-insights">
  <section className="panel shopify-block"><h2>Creative performance & fatigue signals</h2><p>Ad-level performance from imported Meta reports. An ad is the reporting unit; image/video assets and creative-level deduplication are not imported.</p>
   <form method="get" className="creative-filters"><label>Reporting scope<select name="scope" defaultValue={report.query.scope}>{[...new Set(report.accounts.map(accountScope))].map(s=><option key={s} value={s}>{s.replace('|',' · ')}</option>)}</select></label><label>From<input type="date" name="start" defaultValue={report.query.start} required/></label><label>Through<input type="date" name="end" defaultValue={report.query.end} required/></label><button className="button primary">Apply dates</button></form>
   <p>Prior period: {report.query.priorStart} – {report.query.priorEnd}. Possible fatigue requires at least three selected days, 1,000 impressions in each period, CTR down 20% and either exact-range frequency ≥3 or CPA up 20%. This heuristic can flag audience or delivery changes too.</p>
   {report.error&&<p role="alert">{report.error}</p>}{report.query.error&&<p role="alert">{report.query.error}</p>}
   <a className="button" href={'/meta?'+new URLSearchParams({start:report.query.priorStart,end:report.query.end,scope:report.query.scope})}>Open report to sync both periods</a>
  </section>
  <section className="panel shopify-block"><label>Search ads<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Ad name or ID"/></label><div className="table-scroll"><table><thead><tr><th>Ad / account</th><th>Spend</th><th>CTR</th><th>CTR change</th><th>Exact frequency</th><th>CPA</th><th>ROAS</th><th>Signal</th></tr></thead><tbody>{rows.filter(r=>(r.entity.name+' '+r.entity.id).toLowerCase().includes(search.toLowerCase())).map(r=><tr key={key(r)}><td>{r.entity.name}<br/><small>{r.account.name} · {r.entity.status}</small></td><td>{formatMoney(r.metrics.spend,r.account.currency)}</td><td>{fmt(r.metrics.ctr,'%')}</td><td>{fmt(r.ctrChange,'%')}</td><td>{fmt(r.frequency)}</td><td>{formatMoney(r.metrics.cpa===null?null:String(r.metrics.cpa),r.account.currency)}</td><td>{fmt(r.metrics.roas,'×')}</td><td>{labels[r.signal]}</td></tr>)}</tbody></table></div>{!rows.length&&<p>No imported ads match this scope. Connect an account and complete an ad-level import.</p>}</section>
  <section className="panel shopify-block"><h2>Compare two ads</h2><p>Observed performance comparison. These ads were not randomly assigned; results do not establish statistical significance or an experimental winner.</p><div className="creative-filters">{[[first,setFirst,'Ad A'],[second,setSecond,'Ad B']].map(([value,setter,label])=><label key={label as string}>{label as string}<select value={value as string} onChange={e=>(setter as (v:string)=>void)(e.target.value)}><option value="">Choose an ad</option>{rows.map(r=><option key={key(r)} value={key(r)}>{r.entity.name} · {r.account.name}</option>)}</select></label>)}</div>
  {a&&b&&(first===second?<p role="status">Choose two different ads.</p>:<div className="table-scroll"><table><thead><tr><th>Metric</th><th>{a.entity.name}</th><th>{b.entity.name}</th></tr></thead><tbody>{(['spend','purchases','ctr','cpa','roas'] as const).map(k=><tr key={k}><td>{k.toUpperCase()}</td><td>{metric(a.metrics,k,a.account.currency)}</td><td>{metric(b.metrics,k,b.account.currency)}</td></tr>)}</tbody></table></div>)}
  </section>
 </div>;
}
