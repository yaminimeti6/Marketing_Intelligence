import test from 'node:test';
import assert from 'node:assert/strict';
import {hostedSettings} from '../scripts/start-hosted.mjs';
test('Hosted server binds the assigned port and workers require explicit opt-in',()=>{
 assert.deepEqual(hostedSettings({PORT:'10000'}),{port:10000,host:'0.0.0.0',workers:false});
 assert.equal(hostedSettings({HOSTED_WORKERS:'true'}).workers,true);
 assert.equal(hostedSettings({HOSTED_WORKERS:'false'}).workers,false);
 assert.throws(()=>hostedSettings({PORT:'invalid'}));assert.throws(()=>hostedSettings({PORT:'70000'}));assert.throws(()=>hostedSettings({HOSTED_WORKERS:'yes'}));
});
