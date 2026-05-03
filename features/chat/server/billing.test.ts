import assert from 'node:assert/strict';
import test from 'node:test';

import { buildChatBillingDescription, finalizeChatBilling } from './billing';

test('buildChatBillingDescription uses the stable chat billing format', () => {
  assert.equal(buildChatBillingDescription('google/gemini-2.5-flash-lite', 'thread_1'), 'Chat: google/gemini-2.5-flash-lite (thread thread_1)');
});

test('finalizeChatBilling charges authenticated users without guest deduction', async () => {
  const calls: string[] = [];

  await finalizeChatBilling({
    userId: 'user_1',
    guestSessionId: 'guest_1',
    creditCost: 3,
    resolvedModel: 'model_a',
    threadId: 'thread_1',
    deductUserCredits: async ({ userId, amount, description }) => {
      calls.push(`user:${userId}:${amount}:${description}`);
      return { balance: 10, success: true };
    },
    deductGuestCredits: async () => {
      calls.push('guest');
      return { success: true, balance: 5 };
    },
  });

  assert.deepEqual(calls, ['user:user_1:3:Chat: model_a (thread thread_1)']);
});

test('finalizeChatBilling charges guests when no user is present', async () => {
  const calls: string[] = [];

  await finalizeChatBilling({
    userId: null,
    guestSessionId: 'guest_1',
    creditCost: 2,
    resolvedModel: 'model_b',
    threadId: 'thread_2',
    deductUserCredits: async () => {
      calls.push('user');
      return { balance: 0, success: true };
    },
    deductGuestCredits: async (guestSessionId, amount) => {
      calls.push(`guest:${guestSessionId}:${amount}`);
      return { success: true, balance: 4 };
    },
  });

  assert.deepEqual(calls, ['guest:guest_1:2']);
});

test('finalizeChatBilling logs deduction failures as best effort', async () => {
  const logs: string[] = [];

  await finalizeChatBilling({
    userId: 'user_2',
    guestSessionId: null,
    creditCost: 4,
    resolvedModel: 'model_c',
    threadId: 'thread_3',
    deductUserCredits: async () => {
      throw new Error('boom');
    },
    deductGuestCredits: async () => ({ success: true, balance: 0 }),
    logError: (message) => logs.push(message),
  });

  assert.deepEqual(logs, ['Failed to deduct credits:']);
});
