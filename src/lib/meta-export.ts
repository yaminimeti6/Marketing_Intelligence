import {metaTableRows,reportCoverage,selectReportAccounts,type MetaReport} from './meta-report.ts';
export function safeCsvCell(value:unknown){
 let text=value===null||value===undefined?'N/A':String(value);
 // Quote every cell and neutralize spreadsheet formulas, including whitespace prefixes.
 if(/^[\s\u200b\ufeff]*[=+@-]/u.test(text))text="'"+text;
 return '"'+text.replaceAll('"','""')+'"';
}
export function makeMetaCsv(report:MetaReport,sort='spend',generatedAt=new Date().toISOString()){
 if(report.error||report.query.error||!report.schemaReady)throw new Error('Report unavailable');
 const accounts=selectReportAccounts(report.accounts,report.query);if(!accounts.length)throw new Error('No reporting accounts');
 const q=report.query,rows=metaTableRows(report,sort),complete=reportCoverage(report.jobs,accounts,q.start,q.end);
 const headers=['Record type','Source','From','To','Currency','Reporting timezone','Coverage','Generated at UTC','Account','Account ID','Entity ID','Name','Status','Spend','Impressions','Unique reach','All clicks','CTR percent','CPC','CPM','Purchase conversions','Purchase CPA','Meta attributed revenue','Meta ROAS','Last completed account sync','Attribution'];
 const common=['Meta Marketing API',q.start,q.end,accounts[0].currency,accounts[0].timezone,complete?'complete':'incomplete',generatedAt];
 const metadata=['metadata',...common,'','','',`${rows.length} filtered ${q.level} records`,'',...Array(12).fill(''),'Account attribution settings; purchase aliases use precedence; not Shopify sales'];
 const data=rows.map(({entity,account,metrics:m})=>[q.level,...common,account.name,account.id,entity.id,entity.name,entity.status,m.spend,m.impressions,m.reach,m.clicks,m.ctr,m.cpc,m.cpm,m.purchases,m.cpa,m.revenue,m.roas,account.lastSync,'Account attribution settings; purchase aliases use precedence; not Shopify sales']);
 return {csv:'\ufeff'+[headers,metadata,...data].map(row=>row.map(safeCsvCell).join(',')).join('\r\n')+'\r\n',count:rows.length,complete};
}
