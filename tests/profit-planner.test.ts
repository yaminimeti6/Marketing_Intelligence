import {test} from 'node:test';
import assert from 'node:assert/strict';
import {profitPlan,type ProfitInput} from '../src/lib/profit-planner.ts';
const input:ProfitInput={netSales:'10000',cogs:'3000',shipping:'500',fees:'200',otherVariable:'300',adSpend:'2000',overhead:'1000'};
test('profit planning reconciles costs, contribution and break-even using exact money',()=>{
 const p=profitPlan(input);assert.equal(p.variableCosts,'4000.000000');assert.equal(p.contribution,'4000.000000');assert.equal(p.operating,'3000.000000');assert.equal(p.breakEvenAdSpend,'5000.000000');assert.equal(p.breakEvenReturn,'2.000000');assert.equal(p.operatingMargin,'30.000000');
});
test('zero denominators and unprofitable economics do not manufacture a break-even ratio',()=>{
 const p=profitPlan({...input,netSales:'0',adSpend:'0'});assert.equal(p.blendedReturn,null);assert.equal(p.operatingMargin,null);assert.equal(p.breakEvenAdSpend,null);assert.equal(p.breakEvenReturn,null);assert.equal(p.operating,'-5000.000000');
 const boundary=profitPlan({...input,netSales:'5000'});assert.equal(boundary.breakEvenAdSpend,'0.000000');assert.equal(boundary.breakEvenReturn,null);
});
test('blank, negative, exponent and malformed amounts are rejected; large and tiny decimals retain precision',()=>{
 for(const value of ['', '-1','1e6','1,000','NaN','0.0000001'])assert.throws(()=>profitPlan({...input,cogs:value}));
 const p=profitPlan({...input,netSales:'999999999999999999.000001',cogs:'0',shipping:'0',fees:'0',otherVariable:'0',adSpend:'0.000001',overhead:'0'});assert.equal(p.operating,'999999999999999999.000000');
});
