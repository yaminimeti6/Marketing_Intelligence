import {aggregateMetrics,changePercent,dayCount,metaTableRows,periodFacts,reportCoverage,selectReportAccounts,uniqueReach,type MetaReport} from './meta-report.ts';

export function creativeInsights(report:MetaReport) {
  const accounts=selectReportAccounts(report.accounts,report.query),q=report.query;
  const ready=!report.error&&!q.error&&reportCoverage(report.jobs,accounts,q.start,q.end);
  const priorReady=!report.error&&!q.error&&reportCoverage(report.jobs,accounts,q.priorStart,q.priorEnd);
  return metaTableRows({...report,query:{...q,level:'ads',parent:''}}).map(row=>{
    const account=[row.account],key=new Set([row.account.key]);
    const previousFacts=periodFacts(report.facts,key,q.priorStart,q.priorEnd,'ad').filter(f=>f.entityId===row.entity.id);
    const previous=aggregateMetrics(previousFacts,priorReady,uniqueReach(report.ranges,account,q.priorStart,q.priorEnd,'ad',row.entity.id));
    const current=row.metrics;
    const ctrChange=changePercent(current.ctr,previous.ctr),cpaChange=changePercent(current.cpa,previous.cpa);
    const frequency=ready&&Number(current.reach)>0&&current.impressions!==null?Number(current.impressions)/Number(current.reach):null;
    // A bounded heuristic, never a causal diagnosis or an instruction to spend.
    const enough=ready&&priorReady&&dayCount(q.start,q.end)>=3&&Number(current.impressions)>=1000&&Number(previous.impressions)>=1000;
    const fatigue=enough&&ctrChange!==null&&ctrChange<=-20&&(frequency!==null&&frequency>=3||cpaChange!==null&&cpaChange>=20);
    return {...row,previous,frequency,ctrChange,cpaChange,signal:!ready?'coverage_missing':!enough?'insufficient_evidence':fatigue?'review_fatigue':'no_signal'};
  });
}
