import assert from 'node:assert/strict';
import test from 'node:test';

import type { ChatMessage } from '@/features/chat/types';
import { buildImageResponseAudit, inferFinalizationLocale, prepareTextMessagesForFinalization } from './finalization-helpers';
import { finalizeTextChatTurn, finalizeImageChatTurn, type FinalizationStepName } from './finalization';

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

// ── Finalization contract tests ───────────────────────────────────────────────

const BASE_FINISH_CTX = {
  threadId: 'thread-1',
  userId: 'user-1',
  currentTitle: 'Test thread',
  resolvedModel: 'google/gemini-2.5-flash-lite',
  creditCost: 1,
  brandId: null,
  currentChatRunId: null,
  followUpSuggestionsEnabled: false,
  memoryEnabled: false,
  memoryExtractEnabled: false,
  memoryContext: '',
  lastUserPrompt: 'Hello',
};

const TWO_MESSAGES: ChatMessage[] = [
  createMessage({ id: 'u1', role: 'user', text: 'Hello' }),
  createMessage({ id: 'a1', role: 'assistant', text: 'Hi there!' }),
];

test('finalizeTextChatTurn returns ok:true when persistence succeeds', async () => {
  const result = await finalizeTextChatTurn({
    updatedMessages: TWO_MESSAGES,
    usage: null,
    finishCtx: BASE_FINISH_CTX,
    _impl: {
      persist: async () => {},
    },
  });

  assert.equal(result.ok, true);
});

test('finalizeTextChatTurn returns ok:false with fatal class when persistence fails', async () => {
  const dbError = new Error('DB connection refused');

  const result = await finalizeTextChatTurn({
    updatedMessages: TWO_MESSAGES,
    usage: null,
    finishCtx: BASE_FINISH_CTX,
    _impl: {
      persist: async () => { throw dbError; },
      auditError: async () => {},
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.failure.step, 'message_persistence');
    assert.equal(result.failure.class, 'fatal');
    assert.equal(result.failure.error, dbError);
  }
});

test('finalizeTextChatTurn returns ok:true when working-memory step fails (best-effort)', async () => {
  const logged: Array<{ step: FinalizationStepName; error: unknown }> = [];

  const result = await finalizeTextChatTurn({
    updatedMessages: TWO_MESSAGES,
    usage: null,
    finishCtx: { ...BASE_FINISH_CTX, userId: 'user-1' },
    _impl: {
      persist: async () => {},
      refreshWorkingMemory: async () => { throw new Error('working memory timeout'); },
      log: (step, error) => logged.push({ step, error }),
    },
  });

  assert.equal(result.ok, true);
  assert.ok(logged.some((e) => e.step === 'working_memory'), 'expected working_memory log entry');
});

test('finalizeTextChatTurn returns ok:true when audit step fails (best-effort)', async () => {
  const logged: Array<{ step: FinalizationStepName; error: unknown }> = [];

  const result = await finalizeTextChatTurn({
    updatedMessages: TWO_MESSAGES,
    usage: null,
    finishCtx: { ...BASE_FINISH_CTX, currentChatRunId: 'run-1', userId: 'user-1' },
    _impl: {
      persist: async () => {},
      refreshWorkingMemory: async () => {},
      auditSuccess: async () => { throw new Error('audit service unavailable'); },
      log: (step, error) => logged.push({ step, error }),
    },
  });

  assert.equal(result.ok, true);
  assert.ok(logged.some((e) => e.step === 'audit'), 'expected audit log entry');
});

test('finalizeImageChatTurn returns ok:true on success', async () => {
  const result = await finalizeImageChatTurn({
    updatedMessages: TWO_MESSAGES,
    finishCtx: BASE_FINISH_CTX,
    toolMessage: 'Image generation started.',
    _impl: {
      persist: async () => {},
    },
  });

  assert.equal(result.ok, true);
});

test('finalizeImageChatTurn returns ok:false with fatal class when persistence fails', async () => {
  const dbError = new Error('disk full');

  const result = await finalizeImageChatTurn({
    updatedMessages: TWO_MESSAGES,
    finishCtx: BASE_FINISH_CTX,
    toolMessage: 'Image generation started.',
    _impl: {
      persist: async () => { throw dbError; },
      auditError: async () => {},
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.failure.step, 'message_persistence');
    assert.equal(result.failure.class, 'fatal');
  }
});
