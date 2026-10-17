import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { hashPassword, verifyPassword, sealToken, openToken, hashToken, newToken, canManageIntegrations } from '../src/lib/security.ts';

test('passwords use independent salts and reject invalid credentials',()=>{
  const a=hashPassword('a long test password');
  assert.notEqual(a,hashPassword('a long test password'));
  assert.ok(verifyPassword('a long test password',a));
  assert.equal(verifyPassword('incorrect password',a),false);
  assert.equal(verifyPassword('a'.repeat(257),a),false);
  assert.throws(()=>hashPassword('short'));
});
test('encrypted credentials reject tampering, wrong keys and cross-tenant reuse',()=>{
  const key=randomBytes(32).toString('base64');
  const binding='workspace-a:meta:connection-a';
  const encrypted=sealToken('private-provider-token',binding,key);
  assert.ok(!encrypted.includes('private-provider-token'));
  assert.equal(openToken(encrypted,binding,key),'private-provider-token');
  assert.throws(()=>openToken(encrypted,'workspace-b:meta:connection-a',key));
  assert.throws(()=>openToken(encrypted,binding,randomBytes(32).toString('base64')));
  const parts=encrypted.split('.'); parts[3]='AAAA';
  assert.throws(()=>openToken(parts.join('.'),binding,key));
});
test('sessions use opaque independent tokens; viewers cannot manage integrations',()=>{
  const token=newToken();
  assert.notEqual(token,newToken());
  assert.notEqual(token,hashToken(token));
  assert.equal(hashToken(token).length,64);
  assert.equal(canManageIntegrations('viewer'),false);
  assert.ok(canManageIntegrations('owner')&&canManageIntegrations('admin'));
});
