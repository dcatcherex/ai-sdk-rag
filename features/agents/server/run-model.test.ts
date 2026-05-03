import assert from 'node:assert/strict';
import test from 'node:test';

import { EMPTY_SKILL_RUNTIME } from './runtime';
import { estimateRunContextTokens, resolveRunModel, supportsToolsForRunModel } from './run-model';

test('estimateRunContextTokens includes messages, skill blocks, and fixed buffer', () => {
  const total = estimateRunContextTokens({
    messages: [
      { role: 'user', content: 'hello world', parts: [{ type: 'text', text: 'hello world' }] },
      { role: 'assistant', content: 'response', parts: [] },
    ],
    skillRuntime: {
      ...EMPTY_SKILL_RUNTIME,
      activeSkillsBlock: 'active',
      skillResourcesBlock: 'resources',
      catalogBlock: 'catalog',
    },
  });

  assert.ok(total > 3000);
});

test('resolveRunModel prefers valid manual model selection', () => {
  const resolved = resolveRunModel({
    request: {
      messages: [{ role: 'user', content: 'hello', parts: [] }],
      model: 'google/gemini-2.5-flash-lite',
      enabledModelIds: ['google/gemini-2.5-flash-lite'],
      useWebSearch: false,
      policy: {
        maxSteps: 3,
        allowTools: true,
        allowMcp: false,
        allowMemoryRead: true,
        allowMemoryWrite: true,
        allowPromptEnhancement: true,
        allowDirectImageGeneration: true,
        allowDirectVideoGeneration: false,
        responseFormat: 'ui_stream',
      },
    },
    resolvedAgent: null,
    lastUserPrompt: 'hello',
    skillRuntime: EMPTY_SKILL_RUNTIME,
    getCreditCostForModel: () => 1,
  });

  assert.equal(resolved.modelId, 'google/gemini-2.5-flash-lite');
  assert.equal(resolved.routingReason, 'Manual selection');
});

test('resolveRunModel prefers agent default when request model is auto', () => {
  const resolved = resolveRunModel({
    request: {
      messages: [{ role: 'user', content: 'hello', parts: [] }],
      model: 'auto',
      enabledModelIds: ['google/gemini-2.5-flash-lite'],
      useWebSearch: false,
      policy: {
        maxSteps: 3,
        allowTools: true,
        allowMcp: false,
        allowMemoryRead: true,
        allowMemoryWrite: true,
        allowPromptEnhancement: true,
        allowDirectImageGeneration: true,
        allowDirectVideoGeneration: false,
        responseFormat: 'ui_stream',
      },
    },
    resolvedAgent: { modelId: 'google/gemini-2.5-flash-lite' },
    lastUserPrompt: 'hello',
    skillRuntime: EMPTY_SKILL_RUNTIME,
    getCreditCostForModel: () => 1,
  });

  assert.equal(resolved.modelId, 'google/gemini-2.5-flash-lite');
  assert.equal(resolved.routingReason, 'Agent default model');
});

test('supportsToolsForRunModel disables tools for tool-disabled models', () => {
  assert.equal(supportsToolsForRunModel({
    allowTools: true,
    modelId: 'google/gemini-2.5-flash-image',
  }), false);
});
