import type { ChatMessage } from '@/features/chat/types';

export const getThreadPreviewFromMessages = (messages: ChatMessage[]): string => {
  for (let i = messages.length - 1; i >= 0; i--) {
    const textPart = messages[i].parts.find((p) => p.type === 'text');
    if (textPart?.type === 'text' && textPart.text.trim()) {
      return textPart.text.trim();
    }
  }
  return 'Start a conversation…';
};

export const getThreadTitleFromMessages = (messages: ChatMessage[]): string | null => {
  const userMsg = messages.find((m) => m.role === 'user');
  const textPart = userMsg?.parts.find((p) => p.type === 'text');
  if (textPart?.type !== 'text') return null;
  const trimmed = textPart.text.trim();
  if (!trimmed) return null;
  return trimmed.length > 64 ? `${trimmed.slice(0, 64)}…` : trimmed;
};

export const getLastUserPrompt = (messages: ChatMessage[]): string | null => {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role !== 'user') continue;
    const textPart = msg.parts.find((p) => p.type === 'text');
    if (textPart?.type === 'text' && textPart.text.trim()) {
      return textPart.text.trim();
    }
  }
  return null;
};
