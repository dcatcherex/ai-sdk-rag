import assert from 'node:assert/strict';
import test from 'node:test';

import {
  fromProviderResult,
  toCertificateProviderOptions,
} from '../provider-adapter';
import type { NormalizedRunResult } from '@/features/external-tools/types';

// ── toCertificateProviderOptions ──────────────────────────────────────────────

test('toCertificateProviderOptions maps manual source to sidebar', () => {
  const opts = toCertificateProviderOptions({
    userId: 'user_1',
    templateId: 'tmpl_1',
    recipients: [{ values: { name: 'Alice' } }],
    source: 'manual',
  });
  assert.equal(opts.source, 'sidebar');
  assert.equal(opts.toolSlug, 'certificate');
  assert.equal(opts.userId, 'user_1');
});

test('toCertificateProviderOptions maps agent source to agent', () => {
  const opts = toCertificateProviderOptions({
    userId: 'user_1',
    templateId: 'tmpl_1',
    recipients: [{ values: { name: 'Alice' } }],
    source: 'agent',
  });
  assert.equal(opts.source, 'agent');
});

test('toCertificateProviderOptions normalizes object-style recipient values to array', () => {
  const opts = toCertificateProviderOptions({
    userId: 'user_1',
    templateId: 'tmpl_1',
    recipients: [{ values: { name: 'Bob', course: 'Math' } }],
  });
  const recipients = opts.input.recipients as Array<{ values: unknown[] }>;
  assert.ok(Array.isArray(recipients[0].values));
  const values = recipients[0].values as Array<{ fieldId: string; value: string }>;
  assert.ok(values.some((v) => v.fieldId === 'name' && v.value === 'Bob'));
  assert.ok(values.some((v) => v.fieldId === 'course' && v.value === 'Math'));
});

test('toCertificateProviderOptions keeps array-style recipient values as-is', () => {
  const fieldValues = [{ fieldId: 'name', value: 'Carol' }];
  const opts = toCertificateProviderOptions({
    userId: 'user_1',
    templateId: 'tmpl_1',
    recipients: [{ values: fieldValues }],
  });
  const recipients = opts.input.recipients as Array<{ values: unknown }>;
  assert.deepEqual(recipients[0].values, fieldValues);
});

test('toCertificateProviderOptions forwards optional fields', () => {
  const opts = toCertificateProviderOptions({
    userId: 'user_1',
    templateId: 'tmpl_1',
    recipients: [{ values: {} }],
    format: 'pdf',
    pdfQuality: 'high',
    outputMode: 'single_pdf',
    padToGrid: true,
    fillerTemplateId: 'fill_1',
    maxRecipients: 100,
    threadId: 'thread_1',
    idempotencyKey: 'ik_1',
  });
  assert.equal(opts.input.format, 'pdf');
  assert.equal(opts.input.pdfQuality, 'high');
  assert.equal(opts.input.outputMode, 'single_pdf');
  assert.equal(opts.input.padToGrid, true);
  assert.equal(opts.input.fillerTemplateId, 'fill_1');
  assert.equal(opts.input.maxRecipients, 100);
  assert.equal(opts.threadId, 'thread_1');
  assert.equal(opts.idempotencyKey, 'ik_1');
});

// ── fromProviderResult ────────────────────────────────────────────────────────

test('fromProviderResult extracts all fields from data', () => {
  const result: NormalizedRunResult = {
    vajaRunId: 'vr_1',
    providerRunId: 'pr_1',
    status: 'success',
    title: 'Certificates ready',
    data: {
      jobId: 'job_1',
      count: 3,
      downloadLabel: '3 certificates',
      fileKey: 'certs/out.zip',
      fileName: 'out.zip',
      fileUrl: 'https://cdn.example.com/out.zip',
      format: 'pdf',
      outputMode: 'zip',
    },
  };
  const gen = fromProviderResult(result);
  assert.equal(gen.jobId, 'job_1');
  assert.equal(gen.count, 3);
  assert.equal(gen.downloadLabel, '3 certificates');
  assert.equal(gen.fileUrl, 'https://cdn.example.com/out.zip');
  assert.equal(gen.format, 'pdf');
  assert.equal(gen.outputMode, 'zip');
});

test('fromProviderResult falls back to artifact url when data.fileUrl is missing', () => {
  const result: NormalizedRunResult = {
    vajaRunId: 'vr_2',
    providerRunId: 'pr_2',
    status: 'success',
    title: 'Done',
    artifacts: [{ kind: 'file', format: 'png', url: 'https://cdn.example.com/cert.png', label: 'Certificate' }],
  };
  const gen = fromProviderResult(result);
  assert.equal(gen.fileUrl, 'https://cdn.example.com/cert.png');
  assert.equal(gen.fileName, 'Certificate');
});

test('fromProviderResult uses vajaRunId as jobId fallback', () => {
  const result: NormalizedRunResult = {
    vajaRunId: 'vr_3',
    providerRunId: 'pr_3',
    status: 'success',
    title: 'Done',
  };
  const gen = fromProviderResult(result);
  assert.equal(gen.jobId, 'vr_3');
});
