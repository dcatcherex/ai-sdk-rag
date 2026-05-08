import assert from 'node:assert/strict';
import test from 'node:test';

import {
  toGoogleSheetsProviderOptions,
  fromGoogleSheetsResult,
  toGoogleDocsProviderOptions,
  fromGoogleDocsResult,
  toGoogleDriveProviderOptions,
  fromGoogleDriveResult,
  toGoogleSlidesProviderOptions,
  fromGoogleSlidesResult,
} from '../integrations/google-bridge';
import type { NormalizedRunResult } from '../types';

// ── helpers ───────────────────────────────────────────────────────────────────

function makeResult(data?: Record<string, unknown>): NormalizedRunResult {
  return {
    vajaRunId: 'run_1',
    providerRunId: 'pr_1',
    status: 'success',
    title: 'Test result',
    data,
    artifacts: [],
  };
}

// ── toGoogleSheetsProviderOptions ─────────────────────────────────────────────

test('toGoogleSheetsProviderOptions: sets toolSlug and encodes operation in input', () => {
  const opts = toGoogleSheetsProviderOptions(
    'read-sheet-range',
    { spreadsheetId: 'abc', range: 'Sheet1!A1:B5' },
    'user_1',
  );
  assert.equal(opts.toolSlug, 'google-sheets');
  assert.equal(opts.userId, 'user_1');
  assert.equal(opts.source, 'sidebar');
  assert.equal((opts.input as Record<string, unknown>).operation, 'read-sheet-range');
  assert.equal((opts.input as Record<string, unknown>).spreadsheetId, 'abc');
  assert.equal((opts.input as Record<string, unknown>).range, 'Sheet1!A1:B5');
});

test('toGoogleSheetsProviderOptions: defaults threadId to undefined when omitted', () => {
  const opts = toGoogleSheetsProviderOptions('create-spreadsheet', { title: 'New' }, 'user_1');
  assert.equal(opts.threadId, undefined);
});

test('toGoogleSheetsProviderOptions: passes threadId when provided', () => {
  const opts = toGoogleSheetsProviderOptions('append-sheet-row', {}, 'user_1', 'thread_42');
  assert.equal(opts.threadId, 'thread_42');
});

test('toGoogleSheetsProviderOptions: all 5 operations are accepted', () => {
  const ops = ['read-sheet-range', 'append-sheet-row', 'update-sheet-range', 'create-sheet-tab', 'create-spreadsheet'] as const;
  for (const op of ops) {
    const opts = toGoogleSheetsProviderOptions(op, {}, 'user_1');
    assert.equal((opts.input as Record<string, unknown>).operation, op);
  }
});

// ── fromGoogleSheetsResult ────────────────────────────────────────────────────

test('fromGoogleSheetsResult: extracts data from result', () => {
  const data = { values: [['a', 'b'], ['c', 'd']] };
  const out = fromGoogleSheetsResult(makeResult(data));
  assert.deepEqual(out, data);
});

test('fromGoogleSheetsResult: returns empty object when data is undefined', () => {
  const out = fromGoogleSheetsResult(makeResult());
  assert.deepEqual(out, {});
});

// ── toGoogleDocsProviderOptions ───────────────────────────────────────────────

test('toGoogleDocsProviderOptions: sets toolSlug google-docs and encodes operation', () => {
  const opts = toGoogleDocsProviderOptions('create-doc', { title: 'My Doc', content: '# Hi' }, 'user_2');
  assert.equal(opts.toolSlug, 'google-docs');
  assert.equal((opts.input as Record<string, unknown>).operation, 'create-doc');
  assert.equal((opts.input as Record<string, unknown>).title, 'My Doc');
});

test('toGoogleDocsProviderOptions: all 3 operations are accepted', () => {
  const ops = ['create-doc', 'create-doc-from-template', 'append-doc-section'] as const;
  for (const op of ops) {
    const opts = toGoogleDocsProviderOptions(op, {}, 'user_2');
    assert.equal((opts.input as Record<string, unknown>).operation, op);
  }
});

test('fromGoogleDocsResult: returns data record', () => {
  const data = { documentId: 'doc_abc', url: 'https://docs.google.com/d/doc_abc' };
  const out = fromGoogleDocsResult(makeResult(data));
  assert.deepEqual(out, data);
});

// ── toGoogleDriveProviderOptions ──────────────────────────────────────────────

test('toGoogleDriveProviderOptions: sets toolSlug google-drive and encodes operation', () => {
  const opts = toGoogleDriveProviderOptions('list-files', { folderId: 'folder_1' }, 'user_3');
  assert.equal(opts.toolSlug, 'google-drive');
  assert.equal((opts.input as Record<string, unknown>).operation, 'list-files');
  assert.equal((opts.input as Record<string, unknown>).folderId, 'folder_1');
});

test('toGoogleDriveProviderOptions: all 3 operations are accepted', () => {
  const ops = ['list-files', 'create-folder', 'upload-file'] as const;
  for (const op of ops) {
    const opts = toGoogleDriveProviderOptions(op, {}, 'user_3');
    assert.equal((opts.input as Record<string, unknown>).operation, op);
  }
});

test('fromGoogleDriveResult: returns data record', () => {
  const data = { files: [{ id: 'f1', name: 'doc.pdf' }] };
  const out = fromGoogleDriveResult(makeResult(data));
  assert.deepEqual(out, data);
});

// ── toGoogleSlidesProviderOptions ─────────────────────────────────────────────

test('toGoogleSlidesProviderOptions: sets toolSlug google-slides and encodes operation', () => {
  const opts = toGoogleSlidesProviderOptions('create-deck', { title: 'Q3 Review' }, 'user_4');
  assert.equal(opts.toolSlug, 'google-slides');
  assert.equal((opts.input as Record<string, unknown>).operation, 'create-deck');
  assert.equal((opts.input as Record<string, unknown>).title, 'Q3 Review');
});

test('toGoogleSlidesProviderOptions: both operations are accepted', () => {
  const ops = ['create-deck', 'create-deck-from-template'] as const;
  for (const op of ops) {
    const opts = toGoogleSlidesProviderOptions(op, {}, 'user_4');
    assert.equal((opts.input as Record<string, unknown>).operation, op);
  }
});

test('fromGoogleSlidesResult: returns data record', () => {
  const data = { presentationId: 'pres_1', createdSlideCount: 5 };
  const out = fromGoogleSlidesResult(makeResult(data));
  assert.deepEqual(out, data);
});
