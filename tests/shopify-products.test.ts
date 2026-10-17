import {test} from 'node:test';
import assert from 'node:assert/strict';
import {productSales,dateFilter} from '../src/lib/shopify-products.ts';
const product={resource:'products',source:{id:'gid://shopify/Product/1',title:'Example',status:'ACTIVE'}};
const line=(id:string,quantity:number,current:number,amount:string)=>({id,product:{id:'gid://shopify/Product/1'},title:'Example',quantity,currentQuantity:current,priceAfterAllDiscountsBeforeTaxesSet:{shopMoney:{amount,currencyCode:'INR'}}});
const order={resource:'orders',source:{id:'gid://shopify/Order/1',createdAt:'2026-10-15T20:00:00Z',test:false,cancelledAt:null,lineItemsComplete:true,lineItems:{nodes:[line('1',3,2,'100.000001'),line('2',2,1,'50.000001')]}}};
test('Product breakdown counts each order once, retains refunded quantities correctly and sums exact source prices',()=>{
 const result=productSales([product,order],'INR','Asia/Kolkata',true,'2026-10-16','2026-10-16');
 assert.equal(result.rows.length,1);assert.equal(result.rows[0].orders,1);assert.equal(result.ordered,5);assert.equal(result.retained,3);assert.equal(result.rows[0].amount,'150.000002');
 const outside=productSales([product,order],'INR','UTC',true,'2026-10-16','2026-10-16');assert.equal(outside.eligibleOrders,0);assert.equal(outside.filtered,1);assert.equal(outside.rows[0].retained,0);
});
test('Legacy or incomplete line imports never claim zero product sales',()=>{
 assert.equal(productSales([product],'INR','UTC',false).rows[0].retained,null);
 const legacy={...order,source:{...order.source,lineItemsComplete:false}};assert.equal(productSales([product,legacy],'INR','UTC',true).detailsReady,false);
});
test('Product breakdown excludes test/cancelled orders and preserves unknown prices',()=>{
 const testOrder={...order,source:{...order.source,test:true}};
 const result=productSales([product,testOrder],'INR','UTC',true);assert.equal(result.excluded,1);assert.equal(result.eligibleOrders,0);
 const missingPrice={...order,source:{...order.source,lineItems:{nodes:[{...line('1',1,1,'1'),priceAfterAllDiscountsBeforeTaxesSet:null}]}}};
 assert.equal(productSales([product,missingPrice],'INR','UTC',true).rows[0].amount,null);
});
test('Invalid date values cannot crash or shift the selected reporting day',()=>{
 for(const date of ['2026-99-99','2026-02-31','tomorrow',''])assert.equal(dateFilter(date),'');assert.equal(dateFilter('2026-10-16'),'2026-10-16');
});
