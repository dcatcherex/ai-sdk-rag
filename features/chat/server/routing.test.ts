import assert from 'node:assert/strict';
import test from 'node:test';

import { detectRoutingIntent } from './routing-intent';
import { getModelByIntent, getModelUserScore } from './routing';

test('detectRoutingIntent returns empty flags for empty prompt', () => {
  assert.deepEqual(detectRoutingIntent({ prompt: null }), {
    wantsImage: false,
    wantsWeb: false,
    wantsCode: false,
    wantsReasoning: false,
    wordCount: 0,
  });
});

test('detectRoutingIntent marks image prompts without setting unrelated flags', () => {
  assert.deepEqual(detectRoutingIntent({ prompt: 'Generate image of a mango farm at sunset' }), {
    wantsImage: true,
    wantsWeb: false,
    wantsCode: false,
    wantsReasoning: false,
    wordCount: 8,
  });
});

test('detectRoutingIntent treats explicit web search as web intent', () => {
  const intent = detectRoutingIntent({ prompt: 'Tell me about mangoes', useWebSearch: true });

  assert.equal(intent.wantsWeb, true);
  assert.equal(intent.wantsImage, false);
  assert.equal(intent.wantsCode, false);
  assert.equal(intent.wantsReasoning, false);
});

test('detectRoutingIntent marks code prompts', () => {
  const intent = detectRoutingIntent({ prompt: 'Help me refactor this TypeScript function' });

  assert.equal(intent.wantsCode, true);
  assert.equal(intent.wantsImage, false);
  assert.equal(intent.wantsWeb, false);
  assert.equal(intent.wantsReasoning, false);
});

test('detectRoutingIntent marks reasoning prompts', () => {
  const intent = detectRoutingIntent({ prompt: 'Compare the tradeoff between these two plans' });

  assert.equal(intent.wantsReasoning, true);
  assert.equal(intent.wantsImage, false);
  assert.equal(intent.wantsWeb, false);
  assert.equal(intent.wantsCode, false);
});

test('getModelUserScore totals feedback entries per model prefix', () => {
  const score = getModelUserScore(
    'openai/gpt-5.4-mini',
    new Map([
      ['openai/gpt-5.4-mini::thumbs-up', 2],
      ['openai/gpt-5.4-mini::thumbs-down', -1],
      ['openai/gpt-5.4::thumbs-up', 5],
    ]),
  );

  assert.equal(score, 1);
});

test('getModelByIntent keeps image routing behavior', () => {
  const decision = getModelByIntent({
    prompt: 'Generate image of a rice field logo',
    enabledModelIds: ['openai/gpt-5.4-mini', 'openai/gpt-image-2'],
  });

  assert.deepEqual(decision, {
    modelId: 'openai/gpt-image-2',
    reason: 'Image generation request',
  });
});

test('getModelByIntent keeps web routing behavior', () => {
  const decision = getModelByIntent({
    prompt: 'Search the latest AI news',
    enabledModelIds: ['minimax/minimax-m2.7', 'openai/gpt-5.4-mini'],
  });

  assert.deepEqual(decision, {
    modelId: 'openai/gpt-5.4-mini',
    reason: 'Web search intent',
  });
});

test('getModelByIntent keeps coding routing behavior', () => {
  const decision = getModelByIntent({
    prompt: 'Help me debug this TypeScript code',
    enabledModelIds: ['google/gemini-2.5-flash-lite', 'openai/gpt-5.4-mini'],
  });

  assert.deepEqual(decision, {
    modelId: 'openai/gpt-5.4-mini',
    reason: 'Coding intent',
  });
});

test('getModelByIntent keeps reasoning routing behavior', () => {
  const decision = getModelByIntent({
    prompt: 'Evaluate the pros and cons of these two architectures',
    enabledModelIds: ['google/gemini-2.5-flash-lite', 'openai/gpt-5.4-mini'],
  });

  assert.deepEqual(decision, {
    modelId: 'openai/gpt-5.4-mini',
    reason: 'Reasoning intent',
  });
});

test('getModelByIntent keeps simple-query cheap routing behavior', () => {
  const decision = getModelByIntent({
    prompt: 'Summarize this email',
    enabledModelIds: ['google/gemini-2.5-flash-lite', 'openai/gpt-5.4-mini'],
    messageCount: 1,
    hasAgent: false,
    hasActiveSkills: false,
  });

  assert.deepEqual(decision, {
    modelId: 'google/gemini-2.5-flash-lite',
    reason: 'Simple query → cost-optimized model',
  });
});
