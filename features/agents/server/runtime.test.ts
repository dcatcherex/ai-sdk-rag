import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildAgentRunSystemPrompt,
  EMPTY_SKILL_RUNTIME,
  mergeAgentDocumentIds,
  mergeAgentToolIds,
} from './runtime';
import { wantsImageGeneration } from './media-intent';

test('mergeAgentToolIds preserves null as all tools', () => {
  const merged = mergeAgentToolIds({
    baseToolIds: null,
    skillRuntime: { skillToolIds: ['image', 'brand_photos'] },
  });

  assert.equal(merged, null);
});

test('mergeAgentToolIds appends skill-unlocked tools without duplicates', () => {
  const merged = mergeAgentToolIds({
    baseToolIds: ['image', 'content_marketing'],
    skillRuntime: { skillToolIds: ['image', 'brand_photos'] },
  });

  assert.deepEqual(merged, ['image', 'content_marketing', 'brand_photos']);
});

test('mergeAgentDocumentIds unions agent and selected documents', () => {
  const merged = mergeAgentDocumentIds({
    agentDocumentIds: ['agent-doc', 'shared-doc'],
    selectedDocumentIds: ['shared-doc', 'selected-doc'],
  });

  assert.deepEqual(merged, ['agent-doc', 'shared-doc', 'selected-doc']);
});

test('buildAgentRunSystemPrompt keeps shared prompt block ordering', () => {
  const prompt = buildAgentRunSystemPrompt({
    base: 'Base prompt',
    memoryContext: '<memory>Remember this</memory>',
    activeBrand: null,
    skillRuntime: {
      ...EMPTY_SKILL_RUNTIME,
      activeSkillsBlock: '\n\n<active_skills>\nSkill body\n</active_skills>',
    },
    brandPromptInstruction: 'Select a brand first.',
    extraBlocks: ['\n\n<line_channel>LINE</line_channel>'],
  });

  assert.match(prompt, /^Base prompt/);
  assert.match(prompt, /<memory>Remember this<\/memory>[\s\S]*<active_skills>/);
  assert.match(prompt, /<brand_resolution>\nSelect a brand first\.\n<\/brand_resolution>/);
  assert.match(prompt, /<line_channel>LINE<\/line_channel>$/);
});

test('wantsImageGeneration detects English image prompts', () => {
  assert.equal(wantsImageGeneration('Create a Facebook post image for our coffee shop promotion'), true);
  assert.equal(wantsImageGeneration('Write me a tagline for a coffee shop'), false);
});

test('wantsImageGeneration detects Thai image prompts', () => {
  assert.equal(wantsImageGeneration('ช่วยสร้างภาพโฆษณากาแฟสำหรับโพสต์ Facebook'), true);
  assert.equal(wantsImageGeneration('ช่วยคิดแคปชันโปรโมตกาแฟหน่อย'), false);
});
