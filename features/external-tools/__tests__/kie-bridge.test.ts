import assert from 'node:assert/strict';
import test from 'node:test';

import { kieRunToProviderEnvelope, toolRunToMediaJobStatus, scopeBrandContextForProvider } from '../media/kie-bridge';
import type { KieOutputJson } from '../media/types';

// ── kieRunToProviderEnvelope ──────────────────────────────────────────────────

const BASE_DATE = new Date('2026-01-01T00:00:00Z');
const DONE_DATE = new Date('2026-01-01T00:01:00Z');

function makeEnvelopeParams(overrides: {
  runStatus?: string;
  outputJson?: KieOutputJson | null;
  completedAt?: Date | null;
} = {}) {
  return {
    toolRunId: 'run_1',
    toolSlug: 'image',
    runStatus: overrides.runStatus ?? 'pending',
    outputJson: overrides.outputJson ?? null,
    createdAt: BASE_DATE,
    completedAt: overrides.completedAt ?? null,
  };
}

test('kieRunToProviderEnvelope: pending with no output', () => {
  const env = kieRunToProviderEnvelope(makeEnvelopeParams());
  assert.equal(env.status, 'pending');
  assert.equal(env.artifacts?.length, 0);
  assert.equal(env.error, undefined);
});

test('kieRunToProviderEnvelope: success maps output URLs to artifacts', () => {
  const env = kieRunToProviderEnvelope(makeEnvelopeParams({
    runStatus: 'success',
    outputJson: {
      kieTaskId: 'task_abc',
      output: 'https://cdn.example.com/img.jpg',
      outputs: ['https://cdn.example.com/img.jpg'],
    },
    completedAt: DONE_DATE,
  }));
  assert.equal(env.status, 'success');
  assert.equal(env.artifacts?.length, 1);
  assert.equal(env.artifacts?.[0].url, 'https://cdn.example.com/img.jpg');
  assert.equal(env.artifacts?.[0].format, 'jpg');
  assert.equal(env.providerRunId, 'task_abc');
  assert.equal(env.completedAt, DONE_DATE.toISOString());
});

test('kieRunToProviderEnvelope: multi-output labels artifacts sequentially', () => {
  const env = kieRunToProviderEnvelope(makeEnvelopeParams({
    runStatus: 'success',
    outputJson: {
      outputs: ['https://cdn.example.com/a.jpg', 'https://cdn.example.com/b.jpg'],
    },
    completedAt: DONE_DATE,
  }));
  assert.equal(env.artifacts?.length, 2);
  assert.equal(env.artifacts?.[0].label, 'Output 1');
  assert.equal(env.artifacts?.[1].label, 'Output 2');
});

test('kieRunToProviderEnvelope: error status maps to failed', () => {
  const env = kieRunToProviderEnvelope(makeEnvelopeParams({
    runStatus: 'error',
    outputJson: { error: 'Quota exceeded' },
  }));
  assert.equal(env.status, 'failed');
  assert.equal(env.error?.code, 'KIE_ERROR');
  assert.equal(env.error?.message, 'Quota exceeded');
});

test('kieRunToProviderEnvelope: uses providerRunId from outputJson when present', () => {
  const env = kieRunToProviderEnvelope(makeEnvelopeParams({
    outputJson: { providerRunId: 'pr_override', kieTaskId: 'task_abc' },
  }));
  assert.equal(env.providerRunId, 'pr_override');
});

test('kieRunToProviderEnvelope: falls back to kieTaskId then toolRunId', () => {
  const env = kieRunToProviderEnvelope(makeEnvelopeParams({ outputJson: { kieTaskId: 'task_xyz' } }));
  assert.equal(env.providerRunId, 'task_xyz');

  const env2 = kieRunToProviderEnvelope(makeEnvelopeParams({ outputJson: null }));
  assert.equal(env2.providerRunId, 'run_1'); // falls back to toolRunId
});

// ── toolRunToMediaJobStatus ───────────────────────────────────────────────────

function makeRun(overrides: Partial<Parameters<typeof toolRunToMediaJobStatus>[0]> = {}) {
  return {
    id: 'run_1',
    toolSlug: 'image',
    status: 'pending',
    outputJson: null,
    errorMessage: null,
    createdAt: BASE_DATE,
    completedAt: null,
    ...overrides,
  };
}

test('toolRunToMediaJobStatus: pending run has empty output arrays', () => {
  const s = toolRunToMediaJobStatus(makeRun());
  assert.equal(s.status, 'pending');
  assert.deepEqual(s.outputUrls, []);
  assert.deepEqual(s.thumbnailUrls, []);
  assert.equal(s.kind, 'image');
});

test('toolRunToMediaJobStatus: success maps output URLs', () => {
  const s = toolRunToMediaJobStatus(makeRun({
    status: 'success',
    outputJson: {
      output: 'https://cdn.example.com/img.jpg',
      outputs: ['https://cdn.example.com/img.jpg'],
      kieTaskId: 'task_1',
    },
    completedAt: DONE_DATE,
  }));
  assert.equal(s.status, 'success');
  assert.equal(s.outputUrls.length, 1);
  assert.equal(s.providerRunId, 'task_1');
  assert.equal(s.completedAt, DONE_DATE.toISOString());
});

test('toolRunToMediaJobStatus: uses errorMessage for error', () => {
  const s = toolRunToMediaJobStatus(makeRun({
    status: 'error',
    errorMessage: 'Model unavailable',
  }));
  assert.equal(s.status, 'error');
  assert.equal(s.error, 'Model unavailable');
});

test('toolRunToMediaJobStatus: audio slug maps to audio kind', () => {
  const s = toolRunToMediaJobStatus(makeRun({ toolSlug: 'audio' }));
  assert.equal(s.kind, 'audio');
});

// ── scopeBrandContextForProvider ──────────────────────────────────────────────

test('scopeBrandContextForProvider: only includes non-empty fields', () => {
  const ctx = scopeBrandContextForProvider({ brandId: 'brand_1', logoUrl: 'https://logo.png' });
  assert.equal(ctx.brandId, 'brand_1');
  assert.equal(ctx.logoUrl, 'https://logo.png');
  assert.equal(ctx.primaryColor, undefined);
  assert.equal(ctx.brandName, undefined);
});

test('scopeBrandContextForProvider: returns empty object when all fields omitted', () => {
  const ctx = scopeBrandContextForProvider({});
  assert.deepEqual(ctx, {});
});
