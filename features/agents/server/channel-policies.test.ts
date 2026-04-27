import assert from 'node:assert/strict';
import test from 'node:test';

import {
  LINE_AGENT_RUN_POLICY,
  SHARED_LINK_AGENT_RUN_POLICY,
  WEB_AGENT_RUN_POLICY,
} from './channel-policies';
import { wantsImageGeneration } from './media-intent';

test('channel policies preserve the shared direct-image contract across channels', () => {
  assert.equal(WEB_AGENT_RUN_POLICY.allowDirectImageGeneration, true);
  assert.equal(SHARED_LINK_AGENT_RUN_POLICY.allowDirectImageGeneration, true);
  assert.equal(LINE_AGENT_RUN_POLICY.allowDirectImageGeneration, true);
});

test('channel policies keep line plain-text and shared-link privacy constraints explicit', () => {
  assert.equal(LINE_AGENT_RUN_POLICY.responseFormat, 'plain_text');
  assert.equal(SHARED_LINK_AGENT_RUN_POLICY.allowMemoryRead, false);
  assert.equal(SHARED_LINK_AGENT_RUN_POLICY.allowMemoryWrite, false);
  assert.equal(SHARED_LINK_AGENT_RUN_POLICY.allowMcp, false);
});

test('same prompt is image-eligible for web shared-link and line policies', () => {
  const prompt = 'Create a promotional social post image for our summer sale';

  assert.equal(wantsImageGeneration(prompt) && WEB_AGENT_RUN_POLICY.allowDirectImageGeneration, true);
  assert.equal(wantsImageGeneration(prompt) && SHARED_LINK_AGENT_RUN_POLICY.allowDirectImageGeneration, true);
  assert.equal(wantsImageGeneration(prompt) && LINE_AGENT_RUN_POLICY.allowDirectImageGeneration, true);
});
