import assert from 'node:assert/strict';
import test from 'node:test';

import { parseWorkingMemoryResponse } from './shared';
import { formatThreadWorkingMemoryPromptBlock } from './working-memory';

test('formatThreadWorkingMemoryPromptBlock formats existing working memory without brand-memory concerns', () => {
  const block = formatThreadWorkingMemoryPromptBlock({
    id: 'wm_1',
    threadId: 'thread_1',
    brandId: 'brand_1',
    summary: 'User is preparing a committee demo.',
    currentObjective: 'Finalize the slide narrative',
    decisions: ['Use Thai-first examples'],
    openQuestions: ['Which KPI should lead the demo?'],
    importantContext: ['Audience is non-technical'],
    recentArtifacts: ['Draft slide outline'],
    lastMessageId: 'msg_1',
    refreshStatus: 'ready',
    createdAt: new Date('2026-05-03T00:00:00Z'),
    updatedAt: new Date('2026-05-03T00:00:00Z'),
    refreshedAt: new Date('2026-05-03T00:00:00Z'),
    clearedAt: null,
  });

  assert.match(block, /<thread_working_memory>/);
  assert.match(block, /Summary: User is preparing a committee demo\./);
  assert.match(block, /Current objective: Finalize the slide narrative/);
  assert.match(block, /Decisions:\n- Use Thai-first examples/);
  assert.match(block, /Open questions:\n- Which KPI should lead the demo\?/);
  assert.match(block, /Important context:\n- Audience is non-technical/);
  assert.match(block, /Recent artifacts:\n- Draft slide outline/);
});

test('parseWorkingMemoryResponse returns empty working memory for invalid model JSON', () => {
  assert.deepEqual(parseWorkingMemoryResponse('not json at all'), {
    summary: '',
    currentObjective: null,
    decisions: [],
    openQuestions: [],
    importantContext: [],
    recentArtifacts: [],
  });
});
