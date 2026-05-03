import assert from 'node:assert/strict';
import test from 'node:test';

import type { ChatMessage } from '@/features/chat/types';
import type { ImageFilePart } from './schema';
import {
  buildChatMessageInsertRows,
  buildThreadUpdateValues,
  preparePersistableChatMessages,
  selectOrphanedPreservedRows,
} from './message-persistence';

function createMessage(input: {
  id?: string;
  role: ChatMessage['role'];
  text?: string;
  parts?: ChatMessage['parts'];
  metadata?: ChatMessage['metadata'];
}): ChatMessage {
  return {
    id: input.id,
    role: input.role,
    metadata: input.metadata ?? {},
    parts: input.parts ?? (input.text ? [{ type: 'text', text: input.text }] : []),
  } as ChatMessage;
}

test('preparePersistableChatMessages keeps non-image messages without upload work', async () => {
  let uploadCalls = 0;

  const result = await preparePersistableChatMessages({
    updatedMessages: [createMessage({ role: 'user', text: 'hello' })],
    threadId: 'thread_1',
    userId: 'user_1',
    isImageFilePart: (_part): _part is ImageFilePart => false,
    uploadImagePart: async () => {
      uploadCalls += 1;
      throw new Error('should not be called');
    },
  });

  assert.equal(result.messages.length, 1);
  assert.ok(result.messages[0]?.id);
  assert.equal(result.assets.length, 0);
  assert.equal(uploadCalls, 0);
});

test('preparePersistableChatMessages uploads image parts only for authenticated users', async () => {
  const imagePart = { type: 'file', mediaType: 'image/png', url: 'data:image/png;base64,abc' } as const;
  let uploadCalls = 0;

  const authed = await preparePersistableChatMessages({
    updatedMessages: [createMessage({ id: 'm1', role: 'user', parts: [imagePart] as unknown as ChatMessage['parts'] })],
    threadId: 'thread_1',
    userId: 'user_1',
    isImageFilePart: (part): part is ImageFilePart => part.type === 'file',
    uploadImagePart: async ({ part }) => {
      uploadCalls += 1;
      return {
        part: { ...part, url: 'https://cdn.example.com/image.webp', mediaType: 'image/webp' },
        asset: {
          id: 'asset_1',
          userId: 'user_1',
          threadId: 'thread_1',
          messageId: 'm1',
          rootAssetId: 'asset_1',
          version: 1,
          editPrompt: null,
          type: 'image',
          r2Key: 'k',
          url: 'https://cdn.example.com/image.webp',
          thumbnailKey: 'tk',
          thumbnailUrl: 'https://cdn.example.com/thumb.webp',
          mimeType: 'image/webp',
          width: 100,
          height: 100,
          sizeBytes: 123,
        },
      };
    },
  });

  const guest = await preparePersistableChatMessages({
    updatedMessages: [createMessage({ id: 'm2', role: 'user', parts: [imagePart] as unknown as ChatMessage['parts'] })],
    threadId: 'thread_2',
    userId: null,
    isImageFilePart: (part): part is ImageFilePart => part.type === 'file',
    uploadImagePart: async () => {
      throw new Error('guest upload should not run');
    },
  });

  assert.equal(uploadCalls, 1);
  assert.equal(authed.assets.length, 1);
  assert.equal((authed.messages[0]?.parts[0] as { url?: string }).url, 'https://cdn.example.com/image.webp');
  assert.equal(guest.assets.length, 0);
  assert.equal((guest.messages[0]?.parts[0] as { url?: string }).url, imagePart.url);
});

test('selectOrphanedPreservedRows keeps compare and team-run rows not present in main flow', () => {
  const rows = [
    { id: 'keep-compare', metadata: { compareGroupId: 'g1' } },
    { id: 'keep-team', metadata: { teamRun: { runId: 'r1' } } },
    { id: 'skip-main', metadata: { compareGroupId: 'g2' } },
    { id: 'skip-normal', metadata: {} },
  ];

  const result = selectOrphanedPreservedRows(rows, new Set(['skip-main']));
  assert.deepEqual(result.map((row) => row.id), ['keep-compare', 'keep-team']);
});

test('buildChatMessageInsertRows and buildThreadUpdateValues produce persistence-friendly shapes', () => {
  const messages = [
    createMessage({ id: 'u1', role: 'user', text: 'Launch the campaign' }),
    createMessage({ id: 'a1', role: 'assistant', text: 'Draft ready' }),
  ];

  const insertRows = buildChatMessageInsertRows('thread_1', messages);
  const threadValues = buildThreadUpdateValues({
    messages,
    currentTitle: 'New chat',
    brandId: 'brand_1',
  });

  assert.equal(insertRows.length, 2);
  assert.equal(insertRows[0]?.position, 0);
  assert.equal(insertRows[1]?.position, 1);
  assert.equal(threadValues.title, 'Launch the campaign');
  assert.equal(threadValues.preview, 'Draft ready');
  assert.equal(threadValues.brandId, 'brand_1');
});
