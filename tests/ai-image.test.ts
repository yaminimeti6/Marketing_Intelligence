import {test} from 'node:test';
import assert from 'node:assert/strict';
import {boundedBody,generateImage,imageBrief,imageConfiguration} from '../src/lib/ai-image.ts';
const env={OPENAI_API_KEY:'sk-test-only-not-real'};
test('image generation uses a fixed provider, one bounded JPEG and independent image model',async()=>{
 const transport=(async(url,options)=>{assert.equal(url,'https://api.openai.com/v1/images/generations');assert.equal(options?.redirect,'error');const body=JSON.parse(String(options?.body));assert.equal(body.n,1);assert.equal(body.model,'gpt-image-1-mini');assert.equal(body.size,'1024x1024');assert.equal(body.quality,'low');assert.equal(body.output_format,'jpeg');assert.equal(body.response_format,undefined);return Response.json({data:[{b64_json:Buffer.from([255,216,255,217]).toString('base64')}]});}) as typeof fetch;
 const bytes=await generateImage('A plain water bottle on a blue background',env,transport);assert.equal(bytes[0],255);assert.equal(bytes.length,4);
});
test('invalid image brief/configuration never contacts the provider',async()=>{
 for(const prompt of ['', 'short','x'.repeat(1001)])assert.throws(()=>imageBrief(prompt));assert.throws(()=>imageConfiguration({}));assert.throws(()=>imageConfiguration({...env,OPENAI_IMAGE_MODEL:'sora-2'}));
 let calls=0;await assert.rejects(generateImage('A plain product concept',{},(async()=>{calls++;return Response.json({});}) as typeof fetch));assert.equal(calls,0);
});
test('provider errors, external URLs and non-JPEG images never become downloadable results',async()=>{
 for(const status of [400,401,403,404,429,500])await assert.rejects(generateImage('A plain product concept',env,(async()=>new Response('provider private details',{status})) as typeof fetch),e=>e instanceof Error&&!e.message.includes('provider private details'));
 for(const data of [{url:'https://untrusted.example/image.jpg'},{b64_json:'not-base64'},{b64_json:Buffer.from('<svg>bad</svg>').toString('base64')}])await assert.rejects(generateImage('A plain product concept',env,(async()=>Response.json({data:[data]})) as typeof fetch),/no valid image/);
});
test('bounded body rejects declared and streamed oversized responses',async()=>{
 await assert.rejects(boundedBody(new Response('12345'),4));await assert.rejects(boundedBody(new Response('a',{headers:{'Content-Length':'100'}}),4));assert.equal(new TextDecoder().decode(await boundedBody(new Response('test'),4)),'test');
});
