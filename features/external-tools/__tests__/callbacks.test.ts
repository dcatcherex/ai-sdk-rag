import { createHmac } from 'node:crypto';
import assert from 'node:assert/strict';
import test from 'node:test';

import { verifyHmacSignature } from '../callback-crypto';

function sign(body: string, secret: string): string {
  const hex = createHmac('sha256', secret).update(body, 'utf8').digest('hex');
  return `sha256=${hex}`;
}

test('verifyHmacSignature accepts a correct signature', () => {
  const body = JSON.stringify({ providerRunId: 'pr_1', status: 'success', createdAt: '' });
  const secret = 'test-secret-abc';
  const sig = sign(body, secret);
  assert.equal(verifyHmacSignature(body, sig, secret), true);
});

test('verifyHmacSignature rejects a wrong secret', () => {
  const body = JSON.stringify({ providerRunId: 'pr_1', status: 'success', createdAt: '' });
  const sig = sign(body, 'correct-secret');
  assert.equal(verifyHmacSignature(body, sig, 'wrong-secret'), false);
});

test('verifyHmacSignature rejects a tampered body', () => {
  const body = JSON.stringify({ providerRunId: 'pr_1', status: 'success', createdAt: '' });
  const sig = sign(body, 'my-secret');
  const tampered = body + ' ';
  assert.equal(verifyHmacSignature(tampered, sig, 'my-secret'), false);
});

test('verifyHmacSignature rejects a signature without sha256= prefix', () => {
  const body = 'hello';
  const raw = createHmac('sha256', 'secret').update(body, 'utf8').digest('hex');
  assert.equal(verifyHmacSignature(body, raw, 'secret'), false);
});

test('verifyHmacSignature rejects an empty signature string', () => {
  assert.equal(verifyHmacSignature('body', '', 'secret'), false);
});

test('verifyHmacSignature is consistent across calls (no state leak)', () => {
  const body = '{"test":1}';
  const secret = 'stable-secret';
  const sig = sign(body, secret);
  assert.equal(verifyHmacSignature(body, sig, secret), true);
  assert.equal(verifyHmacSignature(body, sig, secret), true);
});
