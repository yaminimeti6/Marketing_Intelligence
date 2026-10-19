export function imageBrief(value:unknown){if(typeof value!=='string'||value.trim().length<10||value.length>1000)throw new Error('Describe the image in 10–1,000 characters.');return value.trim();}
export function imageConfiguration(env:Record<string,string|undefined>){
 const key=env.OPENAI_API_KEY?.trim(),model=env.OPENAI_IMAGE_MODEL?.trim()||'gpt-image-1-mini';
 if(!key||!/^sk-[A-Za-z0-9_-]+$/.test(key))throw new Error('Add OPENAI_API_KEY to the server environment.');
 if(!['gpt-image-1-mini','gpt-image-1','gpt-image-1.5'].includes(model))throw new Error('Choose a supported OPENAI_IMAGE_MODEL.');
 return {key,model};
}
export async function boundedBody(response:Response,limit:number){
 if(Number(response.headers.get('content-length'))>limit)throw new Error('Response too large');
 const reader=response.body?.getReader();if(!reader)throw new Error('Empty response');let total=0;const chunks:Uint8Array[]=[];
 try{while(true){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>limit)throw new Error('Response too large');chunks.push(value);}}catch(e){await reader.cancel().catch(()=>{});throw e;}finally{reader.releaseLock();}
 const result=new Uint8Array(total);let position=0;for(const chunk of chunks){result.set(chunk,position);position+=chunk.byteLength;}return result;
}
export async function generateImage(prompt:string,env:Record<string,string|undefined>,transport:typeof fetch=fetch){
 const brief=imageBrief(prompt),{key,model}=imageConfiguration(env);let response:Response;
 try{response=await transport('https://api.openai.com/v1/images/generations',{method:'POST',redirect:'error',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({model,prompt:'Create a marketing concept image from this brief. Do not invent product claims, testimonials, certifications or health/weight-loss guarantees. Do not add advertising copy unless explicitly requested. Brief: '+brief,n:1,size:'1024x1024',quality:'low',output_format:'jpeg',output_compression:80}),signal:AbortSignal.timeout(45000)});}catch{throw new Error('Image request timed out or could not reach OpenAI. Usage may have been charged; check provider usage before retrying.');}
 if(!response.ok)throw new Error(response.status===429?'OpenAI credits/quota or rate limit reached. Check API billing.':response.status===401?'OpenAI rejected the API key.':response.status===403||response.status===404?'Image model access is unavailable. Check OpenAI project access and organization verification.':response.status===400?'OpenAI could not accept this image request. Revise the brief or check model configuration.':'OpenAI image generation is unavailable. Try later.');
 try{const raw=await boundedBody(response,4000000);const body=JSON.parse(new TextDecoder().decode(raw));const encoded=body.data?.[0]?.b64_json;if(typeof encoded!=='string'||!encoded||!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)||encoded.length%4!==0)throw new Error();const bytes=Buffer.from(encoded,'base64');if(bytes.length>2000000||bytes.length<3||bytes[0]!==255||bytes[1]!==216||bytes[2]!==255)throw new Error();return new Uint8Array(bytes);}catch{throw new Error('OpenAI returned no valid image within the download size limit. Check usage before retrying.');}
}
