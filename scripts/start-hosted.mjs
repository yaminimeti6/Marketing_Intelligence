import {spawn} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';

export function hostedSettings(env){
 const port=Number(env.PORT||3000);
 if(!Number.isInteger(port)||port<1||port>65535)throw new Error('Invalid hosted PORT.');
 if(env.HOSTED_WORKERS&&!['true','false'].includes(env.HOSTED_WORKERS))throw new Error('HOSTED_WORKERS must be true or false.');
 return {port,host:env.HOSTED_BIND_ADDRESS||'0.0.0.0',workers:env.HOSTED_WORKERS==='true'};
}
export function startHosted(env=process.env){
 const config=hostedSettings(env),children=new Set();let stopping=false;
 const stop=(code=0)=>{if(stopping)return;stopping=true;process.exitCode=code;for(const child of children)child.kill('SIGTERM');const timer=setTimeout(()=>{for(const child of children)child.kill('SIGKILL');},8000);timer.unref();};
 const launch=args=>{const child=spawn(process.execPath,args,{stdio:'inherit',windowsHide:true,env:{...env,NODE_ENV:'production'}});children.add(child);child.on('error',()=>{console.error('Hosted process could not start. Credentials withheld.');stop(1);});child.on('exit',code=>{children.delete(child);if(!stopping)stop(code||1);});return child;};
 process.on('SIGINT',()=>stop());process.on('SIGTERM',()=>stop());
 launch([fileURLToPath(new URL('../node_modules/next/dist/bin/next',import.meta.url)),'start','--hostname',config.host,'--port',String(config.port)]);
 if(config.workers){console.log('Hosted workers enabled while this web service is awake. Free hosting can suspend all processing.');launch(['--experimental-strip-types',fileURLToPath(new URL('./watch-workers.mjs',import.meta.url))]);}
 else console.log('Hosted workers disabled. Configure a worker against the cloud database for fresh imports.');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)startHosted();
