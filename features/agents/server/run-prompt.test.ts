import assert from 'node:assert/strict';
import test from 'node:test';

import { EMPTY_SKILL_RUNTIME } from './runtime';
import { buildChannelResponseBlock, buildPreparedRunPrompt } from './run-prompt';

const buildPolicy = (responseFormat: 'plain_text' | 'ui_stream') => ({
  maxSteps: 3,
  allowTools: false,
  allowMcp: false,
  allowMemoryRead: false,
  allowMemoryWrite: false,
  allowPromptEnhancement: true,
  allowDirectImageGeneration: false,
  allowDirectVideoGeneration: false,
  responseFormat,
});

test('buildChannelResponseBlock only adds plain-text guidance for plain_text channels', () => {
  const plain = buildChannelResponseBlock({
    policy: buildPolicy('plain_text'),
  });
  const rich = buildChannelResponseBlock({
    policy: buildPolicy('ui_stream'),
  });

  assert.match(plain, /plain-text channel/i);
  assert.equal(rich, '');
});

test('buildPreparedRunPrompt omits quiz block when tools are disabled', () => {
  const prompt = buildPreparedRunPrompt({
    request: {
      identity: {
        channel: 'web',
        userId: 'user_1',
        billingUserId: 'user_1',
      },
      threadId: 'thread_1',
      messages: [],
      policy: {
        maxSteps: 3,
        allowTools: false,
        allowMcp: false,
        allowMemoryRead: true,
        allowMemoryWrite: true,
        allowPromptEnhancement: true,
        allowDirectImageGeneration: true,
        allowDirectVideoGeneration: false,
        responseFormat: 'ui_stream',
      },
    },
    baseSystemPrompt: 'Base prompt',
    activeBrand: null,
    memoryContext: '',
    effectiveDocumentIds: undefined,
    skillRuntime: EMPTY_SKILL_RUNTIME,
    supportsTools: false,
    channelContext: {
      quizContextBlock: '<quiz_context>quiz-only</quiz_context>',
    },
    brandPromptInstruction: null,
  });

  assert.doesNotMatch(prompt, /quiz-only/);
});

test('buildPreparedRunPrompt appends channel response block for plain-text channels', () => {
  const prompt = buildPreparedRunPrompt({
    request: {
      identity: {
        channel: 'line',
        userId: null,
        billingUserId: 'user_1',
        lineUserId: 'line_1',
      },
      threadId: 'thread_1',
      messages: [],
      policy: {
        maxSteps: 3,
        allowTools: false,
        allowMcp: false,
        allowMemoryRead: false,
        allowMemoryWrite: false,
        allowPromptEnhancement: true,
        allowDirectImageGeneration: false,
        allowDirectVideoGeneration: false,
        responseFormat: 'plain_text',
      },
    },
    baseSystemPrompt: 'Base prompt',
    activeBrand: null,
    memoryContext: '',
    effectiveDocumentIds: undefined,
    skillRuntime: EMPTY_SKILL_RUNTIME,
    supportsTools: false,
    channelContext: {},
    brandPromptInstruction: null,
  });

  assert.match(prompt, /channel_response_format/);
});
