import assert from 'node:assert/strict';
import test from 'node:test';

import { buildTokenUsageInsert } from './token-usage';

test('buildTokenUsageInsert derives total tokens when not provided', () => {
  const row = buildTokenUsageInsert({
    threadId: 'thread_1',
    model: 'model_a',
    tokenUsageData: { promptTokens: 12, completionTokens: 8 },
    createId: () => 'usage_1',
  });

  assert.deepEqual(row, {
    id: 'usage_1',
    threadId: 'thread_1',
    model: 'model_a',
    promptTokens: 12,
    completionTokens: 8,
    totalTokens: 20,
  });
});

test('buildTokenUsageInsert respects explicit total tokens', () => {
  const row = buildTokenUsageInsert({
    threadId: 'thread_2',
    model: 'model_b',
    tokenUsageData: { promptTokens: 12, completionTokens: 8, totalTokens: 50 },
    createId: () => 'usage_2',
  });

  assert.equal(row.totalTokens, 50);
});
