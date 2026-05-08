import assert from 'node:assert/strict';
import test from 'node:test';

import {
  toWebsiteBuilderProviderOptions,
  fromWebsiteBuilderResult,
  toWebDeployProviderOptions,
  fromWebDeployResult,
} from '../web-publisher/web-bridge';
import type { NormalizedRunResult } from '../types';

// ── helpers ───────────────────────────────────────────────────────────────────

function makeResult(data?: Record<string, unknown>): NormalizedRunResult {
  return {
    vajaRunId: 'run_web_1',
    providerRunId: 'pr_web_1',
    status: 'success',
    title: 'Web result',
    data,
    artifacts: [],
  };
}

// ── toWebsiteBuilderProviderOptions ───────────────────────────────────────────

test('toWebsiteBuilderProviderOptions: sets toolSlug and encodes operation', () => {
  const opts = toWebsiteBuilderProviderOptions(
    'generate',
    { businessDescription: 'A bakery', templateSlug: 'service-landing', siteName: 'Sweet Bakes' },
    'user_1',
  );
  assert.equal(opts.toolSlug, 'website-builder');
  assert.equal(opts.userId, 'user_1');
  assert.equal(opts.source, 'sidebar');
  assert.equal((opts.input as Record<string, unknown>).operation, 'generate');
  assert.equal((opts.input as Record<string, unknown>).siteName, 'Sweet Bakes');
});

test('toWebsiteBuilderProviderOptions: defaults threadId to undefined when omitted', () => {
  const opts = toWebsiteBuilderProviderOptions('edit', {}, 'user_1');
  assert.equal(opts.threadId, undefined);
});

test('toWebsiteBuilderProviderOptions: passes threadId when provided', () => {
  const opts = toWebsiteBuilderProviderOptions('publish', {}, 'user_1', 'thread_5');
  assert.equal(opts.threadId, 'thread_5');
});

test('toWebsiteBuilderProviderOptions: all 4 operations are accepted', () => {
  const ops = ['generate', 'edit', 'publish', 'get-status'] as const;
  for (const op of ops) {
    const opts = toWebsiteBuilderProviderOptions(op, {}, 'user_1');
    assert.equal((opts.input as Record<string, unknown>).operation, op);
  }
});

// ── fromWebsiteBuilderResult ──────────────────────────────────────────────────

test('fromWebsiteBuilderResult: extracts data from result', () => {
  const data = { websiteId: 'site_1', htmlUrl: 'https://cdn.example.com/index.html' };
  const out = fromWebsiteBuilderResult(makeResult(data));
  assert.deepEqual(out, data);
});

test('fromWebsiteBuilderResult: returns empty object when data is undefined', () => {
  const out = fromWebsiteBuilderResult(makeResult());
  assert.deepEqual(out, {});
});

// ── toWebDeployProviderOptions ────────────────────────────────────────────────

test('toWebDeployProviderOptions: sets toolSlug web-deploy and encodes operation', () => {
  const opts = toWebDeployProviderOptions(
    'read-file',
    { path: 'app/page.tsx' },
    'user_2',
  );
  assert.equal(opts.toolSlug, 'web-deploy');
  assert.equal(opts.userId, 'user_2');
  assert.equal(opts.source, 'sidebar');
  assert.equal((opts.input as Record<string, unknown>).operation, 'read-file');
  assert.equal((opts.input as Record<string, unknown>).path, 'app/page.tsx');
});

test('toWebDeployProviderOptions: passes threadId to provider options', () => {
  const opts = toWebDeployProviderOptions('preview-change', {}, 'user_2', 'thread_9');
  assert.equal(opts.threadId, 'thread_9');
});

test('toWebDeployProviderOptions: confirm-change encodes toolRunId in input', () => {
  const opts = toWebDeployProviderOptions(
    'confirm-change',
    { toolRunId: 'run_preview_1' },
    'user_2',
  );
  assert.equal((opts.input as Record<string, unknown>).operation, 'confirm-change');
  assert.equal((opts.input as Record<string, unknown>).toolRunId, 'run_preview_1');
});

test('toWebDeployProviderOptions: all 3 operations are accepted', () => {
  const ops = ['read-file', 'preview-change', 'confirm-change'] as const;
  for (const op of ops) {
    const opts = toWebDeployProviderOptions(op, {}, 'user_2');
    assert.equal((opts.input as Record<string, unknown>).operation, op);
  }
});

// ── fromWebDeployResult ───────────────────────────────────────────────────────

test('fromWebDeployResult: extracts read-file response', () => {
  const data = { exists: true, content: 'export default function Page() {}', sha: 'abc123', path: 'app/page.tsx' };
  const out = fromWebDeployResult(makeResult(data));
  assert.deepEqual(out, data);
});

test('fromWebDeployResult: extracts preview response with nested preview data', () => {
  const data = {
    toolRunId: 'run_1',
    preview: { changeType: 'copy_edit', targetPath: 'app/page.tsx', newContent: '...', summary: 'Update hero' },
  };
  const out = fromWebDeployResult(makeResult(data));
  assert.equal((out.preview as Record<string, unknown>).changeType, 'copy_edit');
});

test('fromWebDeployResult: extracts confirm response with PR data', () => {
  const data = { prUrl: 'https://github.com/org/repo/pull/42', prNumber: 42, branchName: 'web-deploy/copy_edit/20260107' };
  const out = fromWebDeployResult(makeResult(data));
  assert.equal(out.prUrl, 'https://github.com/org/repo/pull/42');
  assert.equal(out.prNumber, 42);
});

test('fromWebDeployResult: returns empty object when data is undefined', () => {
  const out = fromWebDeployResult(makeResult());
  assert.deepEqual(out, {});
});
