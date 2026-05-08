import assert from 'node:assert/strict';
import test from 'node:test';

import { ProviderClient } from '../provider-client';
import { ProviderAuthError, ProviderTimeoutError, ProviderUnavailableError } from '../errors';

const MOCK_BASE = 'http://localhost:9999';

function makeClient(opts: { timeoutMs?: number } = {}): ProviderClient {
  return new ProviderClient({ baseUrl: MOCK_BASE, providerKey: 'test', ...opts });
}

const VALID_ENVELOPE = {
  requestId: 'req_1',
  idempotencyKey: 'ik_1',
  vajaRunId: 'vr_1',
  toolSlug: 'certificate',
  source: 'agent' as const,
  userRef: 'user_1',
  input: {},
};

test('checkHealth returns true for ok status', async () => {
  global.fetch = async () =>
    ({ ok: true, status: 200, json: async () => ({ status: 'ok' }) }) as Response;
  const client = makeClient();
  assert.equal(await client.checkHealth(), true);
});

test('checkHealth returns false when provider reports down', async () => {
  global.fetch = async () =>
    ({ ok: true, status: 200, json: async () => ({ status: 'down' }) }) as Response;
  const client = makeClient();
  assert.equal(await client.checkHealth(), false);
});

test('checkHealth returns false when fetch throws', async () => {
  global.fetch = async () => {
    throw new Error('ECONNREFUSED');
  };
  const client = makeClient();
  assert.equal(await client.checkHealth(), false);
});

test('runSync parses a valid success envelope', async () => {
  const body = {
    providerRunId: 'pr_1',
    status: 'success',
    title: 'Done',
    createdAt: new Date().toISOString(),
  };
  global.fetch = async () =>
    ({ ok: true, status: 200, json: async () => body }) as Response;
  const client = makeClient();
  const result = await client.runSync('certificate', VALID_ENVELOPE);
  assert.equal(result.status, 'success');
  assert.equal(result.providerRunId, 'pr_1');
});

test('runSync throws ProviderAuthError on 401', async () => {
  global.fetch = async () =>
    ({ ok: false, status: 401, json: async () => ({}) }) as Response;
  const client = makeClient();
  await assert.rejects(
    () => client.runSync('certificate', VALID_ENVELOPE),
    ProviderAuthError,
  );
});

test('runSync throws ProviderUnavailableError when fetch rejects', async () => {
  global.fetch = async () => {
    throw new Error('ECONNREFUSED');
  };
  const client = makeClient();
  await assert.rejects(
    () => client.runSync('certificate', VALID_ENVELOPE),
    ProviderUnavailableError,
  );
});

test('runSync throws ProviderTimeoutError when aborted', async () => {
  global.fetch = (_url: RequestInfo | URL, opts: RequestInit = {}) => {
    return new Promise<Response>((_resolve, reject) => {
      opts.signal?.addEventListener('abort', () => {
        const err = new Error('AbortError');
        err.name = 'AbortError';
        reject(err);
      });
    });
  };
  const client = makeClient({ timeoutMs: 1 });
  await assert.rejects(
    () => client.runSync('certificate', VALID_ENVELOPE),
    ProviderTimeoutError,
  );
});

test('buildEnvelope auto-generates a requestId', () => {
  const client = makeClient();
  const env = client.buildEnvelope({
    idempotencyKey: 'ik_1',
    vajaRunId: 'vr_1',
    toolSlug: 'certificate',
    source: 'sidebar',
    userRef: 'user_1',
    input: { name: 'Test' },
  });
  assert.ok(env.requestId);
  assert.equal(env.toolSlug, 'certificate');
});
