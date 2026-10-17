import type {ShopifyReport} from '../server/shopify-report.ts';
import {filteredProductRows} from './shopify-products.ts';
import {safeCsvCell} from './meta-export.ts';
export function shopifyCsv(report:ShopifyReport,storeId:string,search='',status='all',sort='units'){
 const store=report.stores.find(s=>s.id===storeId);if(!report.available||!store?.ready||!store.sales.detailsReady)throw new Error('import_required');
 const rows=filteredProductRows(store.sales.rows,search.slice(0,120),status,sort),common=[store.name,report.from||'all imported dates',report.to||'all imported dates',store.timezone,'imported snapshots; not complete Shopify Analytics Net Sales'];
 const table=[['Record type','Store','From','To','Timezone','Coverage','Product','Product ID','Status','Currency','Orders','Units ordered','Units retained','Retained item subtotal'],['metadata',...common,`${rows.length} filtered products`,'','','','','','',''],...rows.map(r=>['product',...common,r.title,r.id,r.status,r.currency,r.orders,r.ordered,r.retained,r.amount])];
 return {csv:'\ufeff'+table.map(r=>r.map(safeCsvCell).join(',')).join('\r\n')+'\r\n',count:rows.length};
}
