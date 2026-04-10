'use client';

type PendingChatIntent = {
  agentId: string | null;
};

let pendingChatIntent: PendingChatIntent | null = null;

export const setPendingChatIntent = (intent: PendingChatIntent) => {
  pendingChatIntent = intent;
};

export const consumePendingChatIntent = (): PendingChatIntent | null => {
  const intent = pendingChatIntent;
  pendingChatIntent = null;
  return intent;
};
