import assert from 'node:assert/strict';
import test from 'node:test';

import { EMPTY_SKILL_RUNTIME } from '@/features/agents/server/runtime';
import { buildQuizContextBlock, buildWebChannelContext } from './web-channel-context';

test('buildQuizContextBlock returns empty string when quiz context is absent', () => {
  assert.equal(buildQuizContextBlock({ quizContext: null }), '');
});

test('buildQuizContextBlock includes completion state and attempts', () => {
  const block = buildQuizContextBlock({
    quizContext: {
      messageId: 'msg_1',
      answeredCount: 3,
      questionCount: 5,
      correctCount: 2,
      objectiveAnsweredCount: 3,
      completed: true,
      attempts: [
        {
          question: 'What is 2+2?',
          topic: 'Math',
          type: 'multiple_choice',
          userAnswer: '3',
          correctAnswer: '4',
          wasRevealed: false,
          isCorrect: false,
        },
      ],
    },
  });

  assert.match(block, /Quiz completed: yes/);
  assert.match(block, /What is 2\+2\?/);
  assert.match(block, /incorrect/);
});

test('buildWebChannelContext preserves web-only overrides for prepareAgentRun', () => {
  const channelContext = buildWebChannelContext({
    memoryContext: 'memory',
    sharedMemoryBlock: 'shared',
    threadWorkingMemoryBlock: 'thread',
    conversationSummaryBlock: 'summary',
    quizContextBlock: 'quiz',
    imageBlocks: ['img1', 'img2', 'img3'],
    rerankEnabled: true,
    referenceImageUrls: ['https://example.com/a.png'],
    mcpCredentials: { server: 'token' },
    baseToolIds: ['search'],
    activeAgent: null,
    baseSystemPromptOverride: 'base',
    userScores: new Map([['model::thumbs', 1]]),
    toolsOverride: {},
    skillRuntime: EMPTY_SKILL_RUNTIME,
  });

  assert.equal(channelContext.memoryContext, 'memory');
  assert.deepEqual(channelContext.extraBlocks, ['img1', 'img2', 'img3']);
  assert.deepEqual(channelContext.referenceImageUrls, ['https://example.com/a.png']);
  assert.equal(channelContext.baseSystemPromptOverride, 'base');
  assert.equal(channelContext.skillRuntimeOverride, EMPTY_SKILL_RUNTIME);
});
