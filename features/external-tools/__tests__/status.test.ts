import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeToolRunRecord } from '../status-normalize';

function makeRun(overrides: Partial<Parameters<typeof normalizeToolRunRecord>[0]> = {}) {
  return {
    id: 'run_1',
    toolSlug: 'certificate',
    status: 'pending',
    inputJson: { _provider: 'certificate', templateId: 'tmpl_1' },
    outputJson: { providerRunId: 'pr_1', title: 'In progress' },
    errorMessage: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    completedAt: null,
    ...overrides,
  };
}

test('normalizeToolRunRecord extracts providerRunId and providerKey', () => {
  const result = normalizeToolRunRecord(makeRun(), []);
  assert.equal(result.providerRunId, 'pr_1');
  assert.equal(result.providerKey, 'certificate');
  assert.equal(result.title, 'In progress');
});

test('normalizeToolRunRecord includes artifacts with label from payloadJson', () => {
  const result = normalizeToolRunRecord(makeRun({ status: 'completed' }), [
    { kind: 'file', format: 'pdf', storageUrl: 'https://cdn.example.com/cert.pdf', payloadJson: { label: 'Certificate PDF' } },
  ]);
  assert.equal(result.artifacts.length, 1);
  assert.equal(result.artifacts[0].url, 'https://cdn.example.com/cert.pdf');
  assert.equal(result.artifacts[0].label, 'Certificate PDF');
  assert.equal(result.artifacts[0].format, 'pdf');
});

test('normalizeToolRunRecord uses errorMessage for error field', () => {
  const result = normalizeToolRunRecord(
    makeRun({ status: 'failed', errorMessage: 'Template not found' }),
    [],
  );
  assert.equal(result.error, 'Template not found');
  assert.equal(result.status, 'failed');
});

test('normalizeToolRunRecord falls back to outputJson.error.message when errorMessage is null', () => {
  const result = normalizeToolRunRecord(
    makeRun({
      status: 'failed',
      errorMessage: null,
      outputJson: { providerRunId: 'pr_1', error: { message: 'Render error' } },
    }),
    [],
  );
  assert.equal(result.error, 'Render error');
});

test('normalizeToolRunRecord formats dates as ISO strings', () => {
  const result = normalizeToolRunRecord(
    makeRun({ completedAt: new Date('2026-01-01T01:00:00Z') }),
    [],
  );
  assert.equal(result.createdAt, '2026-01-01T00:00:00.000Z');
  assert.equal(result.completedAt, '2026-01-01T01:00:00.000Z');
});

test('normalizeToolRunRecord returns null completedAt when not set', () => {
  const result = normalizeToolRunRecord(makeRun({ completedAt: null }), []);
  assert.equal(result.completedAt, null);
});

test('normalizeToolRunRecord returns empty artifacts array when none', () => {
  const result = normalizeToolRunRecord(makeRun(), []);
  assert.deepEqual(result.artifacts, []);
});
