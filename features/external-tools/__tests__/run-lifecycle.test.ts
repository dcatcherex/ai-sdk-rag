import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeRunResult } from '../normalize';
import type { ProviderResponseEnvelope } from '../types';

test('normalizeRunResult maps a success response correctly', () => {
  const response: ProviderResponseEnvelope = {
    providerRunId: 'pr_1',
    status: 'success',
    title: 'Certificate generated',
    summary: '5 recipients',
    data: { count: 5 },
    artifacts: [{ kind: 'file', format: 'pdf', url: 'https://example.com/out.pdf', label: 'Output' }],
    usage: { durationMs: 1200 },
    createdAt: '2026-01-01T00:00:00Z',
    completedAt: '2026-01-01T00:00:01Z',
  };

  const result = normalizeRunResult('vr_1', response);

  assert.equal(result.vajaRunId, 'vr_1');
  assert.equal(result.providerRunId, 'pr_1');
  assert.equal(result.status, 'success');
  assert.equal(result.title, 'Certificate generated');
  assert.equal(result.artifacts?.length, 1);
  assert.equal(result.completedAt, '2026-01-01T00:00:01Z');
});

test('normalizeRunResult falls back to data.title when title is absent', () => {
  const response: ProviderResponseEnvelope = {
    providerRunId: 'pr_2',
    status: 'success',
    data: { title: 'From data' },
    createdAt: '2026-01-01T00:00:00Z',
  };
  const result = normalizeRunResult('vr_2', response);
  assert.equal(result.title, 'From data');
});

test('normalizeRunResult uses generic fallback title when both title fields are absent', () => {
  const response: ProviderResponseEnvelope = {
    providerRunId: 'pr_3',
    status: 'success',
    createdAt: '2026-01-01T00:00:00Z',
  };
  const result = normalizeRunResult('vr_3', response);
  assert.equal(result.title, 'Tool result');
});

test('normalizeRunResult preserves error on failed runs', () => {
  const response: ProviderResponseEnvelope = {
    providerRunId: 'pr_4',
    status: 'failed',
    error: { code: 'RENDER_ERROR', message: 'Template not found', retryable: false },
    createdAt: '2026-01-01T00:00:00Z',
  };
  const result = normalizeRunResult('vr_4', response);
  assert.equal(result.status, 'failed');
  assert.equal(result.error?.code, 'RENDER_ERROR');
});
