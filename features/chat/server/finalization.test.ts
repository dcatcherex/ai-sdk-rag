import assert from 'node:assert/strict';
import test from 'node:test';

import type { ChatMessage } from '@/features/chat/types';
import { buildImageResponseAudit, inferFinalizationLocale, prepareTextMessagesForFinalization } from './finalization-helpers';

function createMessage(input: {
  id: string;
  role: ChatMessage['role'];
  text?: string;
}): ChatMessage {
  return {
    id: input.id,
    role: input.role,
    metadata: {},
    parts: input.text
      ? [{ type: 'text', text: input.text }]
      : [],
  } as ChatMessage;
}

test('prepareTextMessagesForFinalization adds follow-up suggestions and response audit to the last assistant message', async () => {
  const messages: ChatMessage[] = [
    createMessage({ id: 'u1', role: 'user', text: 'Help me draft a mango campaign update.' }),
    createMessage({ id: 'a1', role: 'assistant', text: 'Here is a draft update for the mango campaign.' }),
  ];

  const result = await prepareTextMessagesForFinalization({
    messages,
    lastUserPrompt: 'Help me draft a mango campaign update.',
    followUpSuggestionsEnabled: true,
    generateSuggestions: async () => ['Make it shorter', 'Translate to Thai'],
  });

  const assistant = result.messages[1];
  assert.deepEqual(assistant?.metadata?.followUpSuggestions, ['Make it shorter', 'Translate to Thai']);
  assert.ok(assistant?.metadata?.responseFormat);
  assert.ok(result.responseAudit);
});

test('prepareTextMessagesForFinalization skips follow-up generation when disabled', async () => {
  const messages: ChatMessage[] = [
    createMessage({ id: 'u1', role: 'user', text: 'Summarize this update.' }),
    createMessage({ id: 'a1', role: 'assistant', text: 'Summary ready.' }),
  ];

  let called = false;
  const result = await prepareTextMessagesForFinalization({
    messages,
    lastUserPrompt: 'Summarize this update.',
    followUpSuggestionsEnabled: false,
    generateSuggestions: async () => {
      called = true;
      return ['Should not be used'];
    },
  });

  assert.equal(called, false);
  assert.equal(result.messages[1]?.metadata?.followUpSuggestions, undefined);
  assert.ok(result.messages[1]?.metadata?.responseFormat);
});

test('inferFinalizationLocale detects Thai text', () => {
  assert.equal(inferFinalizationLocale('สร้างภาพใหม่ให้หน่อย', 'ขออีกภาพ'), 'th-TH');
});

test('buildImageResponseAudit returns a stable image audit summary', () => {
  const audit = buildImageResponseAudit('Generate another image variation.', 'Make another version');
  assert.equal(audit.quickReplyCount, 0);
  assert.ok(Array.isArray(audit.responseFormats));
});
