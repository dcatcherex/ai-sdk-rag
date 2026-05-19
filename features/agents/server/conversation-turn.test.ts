import assert from 'node:assert/strict';
import test from 'node:test';

import { SHARED_LINK_AGENT_RUN_POLICY, WEB_AGENT_RUN_POLICY } from './channel-policies';
import { resolveConversationTurnExecution } from './conversation-turn-decision';

test('conversation turn uses direct image mode only for eligible prompts and policies', () => {
  assert.equal(
    resolveConversationTurnExecution({
      policy: WEB_AGENT_RUN_POLICY,
      lastUserPrompt: 'Create a product image for my mango farm promotion',
    }),
    'direct_image',
  );

  assert.equal(
    resolveConversationTurnExecution({
      policy: WEB_AGENT_RUN_POLICY,
      lastUserPrompt: 'What should I write in the caption?',
    }),
    'text',
  );

  assert.equal(
    resolveConversationTurnExecution({
      policy: { ...WEB_AGENT_RUN_POLICY, allowDirectImageGeneration: false },
      lastUserPrompt: 'Create a product image for my mango farm promotion',
    }),
    'text',
  );
});

test('shared-link channel uses the same direct image decision as web', () => {
  const prompt = 'Generate an image of fresh vegetables for a LINE promotion';

  assert.equal(
    resolveConversationTurnExecution({ policy: WEB_AGENT_RUN_POLICY, lastUserPrompt: prompt }),
    'direct_image',
  );
  assert.equal(
    resolveConversationTurnExecution({ policy: SHARED_LINK_AGENT_RUN_POLICY, lastUserPrompt: prompt }),
    'direct_image',
  );
});
