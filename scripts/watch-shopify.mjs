import { spawn } from 'node:child_process';
import { setTimeout } from 'node:timers/promises';
let stopping=false,child;
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{stopping=true;child?.kill();});
console.log('Shopify worker watching queued jobs every 5 seconds. Press Ctrl+C to stop.');
while(!stopping){
 const code=await new Promise(resolve=>{
  child=spawn(process.execPath,['--experimental-strip-types','scripts/shopify-worker.ts'],{stdio:'inherit',windowsHide:true});
  child.on('error',()=>resolve(1));child.on('exit',resolve);
 });
 if(code&&!stopping)console.log('Worker unavailable; checking again in 5 seconds.');
 if(!stopping)await setTimeout(5000);
}
