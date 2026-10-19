export const profitFields=['netSales','cogs','shipping','fees','otherVariable','adSpend','overhead'] as const;
export type ProfitField=typeof profitFields[number];
export type ProfitInput=Record<ProfitField,string>;
const scale=1000000n;
function amount(value:string){
 if(!/^\d{1,18}(?:\.\d{1,6})?$/.test(value))throw new Error('Enter every amount as a non-negative number with up to six decimal places.');
 const [whole,fraction='']=value.split('.');return BigInt(whole)*scale+BigInt(fraction.padEnd(6,'0'));
}
function decimal(value:bigint){const negative=value<0n,v=negative?-value:value;return (negative?'-':'')+(v/scale).toString()+'.'+(v%scale).toString().padStart(6,'0');}
function ratio(numerator:bigint,denominator:bigint,multiplier=1n){if(denominator<=0n)return null;return decimal(numerator*multiplier*scale/denominator);}
export function profitPlan(input:ProfitInput){
 const x=Object.fromEntries(profitFields.map(k=>[k,amount(input[k])])) as Record<ProfitField,bigint>;
 const variable=x.cogs+x.shipping+x.fees+x.otherVariable,preAd=x.netSales-variable;
 const contribution=preAd-x.adSpend,operating=contribution-x.overhead,available=preAd-x.overhead;
 return {variableCosts:decimal(variable),preAdContribution:decimal(preAd),contribution:decimal(contribution),operating:decimal(operating),contributionMargin:ratio(contribution,x.netSales,100n),operatingMargin:ratio(operating,x.netSales,100n),blendedReturn:ratio(x.netSales,x.adSpend),breakEvenReturn:x.netSales>0n?ratio(x.netSales,available):null,breakEvenAdSpend:available>=0n?decimal(available):null};
}
