import assert from 'node:assert/strict';
import test from 'node:test';

import { selectModel } from './model-selector';

const BASE = {
  prompt: 'hello',
  enabledModelIds: ['google/gemini-2.5-flash-lite', 'openai/gpt-5.4-mini'],
  estimatedInputTokens: 500,
  allowTools: true,
  defaultChatModel: 'google/gemini-2.5-flash-lite',
};

test('selectModel returns manual_override when requestedModel is in enabledModelIds', () => {
  const result = selectModel({
    ...BASE,
    requestedModel: 'google/gemini-2.5-flash-lite',
    agentModelId: null,
  });
  assert.equal(result.reason, 'manual_override');
  assert.equal(result.modelId, 'google/gemini-2.5-flash-lite');
});

test('selectModel ignores requestedModel not in enabledModelIds', () => {
  const result = selectModel({
    ...BASE,
    requestedModel: 'anthropic/claude-opus-4.6',
    agentModelId: null,
  });
  assert.notEqual(result.modelId, 'anthropic/claude-opus-4.6');
  assert.notEqual(result.reason, 'manual_override');
});

test('selectModel returns agent_override when model is auto and agentModelId is enabled', () => {
  const result = selectModel({
    ...BASE,
    requestedModel: 'auto',
    agentModelId: 'openai/gpt-5.4-mini',
  });
  assert.equal(result.reason, 'agent_override');
  assert.equal(result.modelId, 'openai/gpt-5.4-mini');
});

test('selectModel returns image_intent for image generation prompts', () => {
  const result = selectModel({
    ...BASE,
    requestedModel: null,
    agentModelId: null,
    enabledModelIds: ['openai/gpt-5.4-mini', 'openai/gpt-image-2'],
    prompt: 'Generate image of a rice field logo',
  });
  assert.equal(result.reason, 'image_intent');
  assert.equal(result.modelId, 'openai/gpt-image-2');
});

test('selectModel returns web_intent for web search prompts', () => {
  const result = selectModel({
    ...BASE,
    requestedModel: null,
    agentModelId: null,
    enabledModelIds: ['minimax/minimax-m2.7', 'openai/gpt-5.4-mini'],
    prompt: 'Search the latest AI news',
  });
  assert.equal(result.reason, 'web_intent');
  assert.equal(result.modelId, 'openai/gpt-5.4-mini');
});

test('selectModel returns code_intent for coding prompts and picks strong model', () => {
  const result = selectModel({
    ...BASE,
    requestedModel: null,
    agentModelId: null,
    prompt: 'Help me debug this TypeScript code',
  });
  assert.equal(result.reason, 'code_intent');
  assert.equal(result.modelId, 'openai/gpt-5.4-mini');
});

test('selectModel returns cost_optimized for simple queries', () => {
  const result = selectModel({
    ...BASE,
    requestedModel: null,
    agentModelId: null,
    prompt: 'Summarize this email',
    hasAgent: false,
    hasActiveSkills: false,
    messageCount: 1,
  });
  assert.equal(result.reason, 'cost_optimized');
  assert.equal(result.modelId, 'google/gemini-2.5-flash-lite');
});

test('selectModel sets supportsTools true for normal text models with allowTools', () => {
  const result = selectModel({
    ...BASE,
    requestedModel: 'google/gemini-2.5-flash-lite',
    agentModelId: null,
    allowTools: true,
  });
  assert.equal(result.supportsTools, true);
});

test('selectModel sets supportsTools false when allowTools is false', () => {
  const result = selectModel({
    ...BASE,
    requestedModel: 'google/gemini-2.5-flash-lite',
    agentModelId: null,
    allowTools: false,
  });
  assert.equal(result.supportsTools, false);
});

test('selectModel passes estimatedInputTokens through to ModelSelection', () => {
  const result = selectModel({
    ...BASE,
    requestedModel: 'google/gemini-2.5-flash-lite',
    agentModelId: null,
    estimatedInputTokens: 12345,
  });
  assert.equal(result.estimatedInputTokens, 12345);
});
