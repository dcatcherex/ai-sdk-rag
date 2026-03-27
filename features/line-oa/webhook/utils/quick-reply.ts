import type { QuickReplyItem } from '../types';
import { QUICK_REPLY_LABEL_MAX } from '../types';

/**
 * Build a message-action quick reply button.
 * Label is truncated to LINE's 20-char limit.
 * The full text is sent as the user's message when tapped.
 */
export function buildQuickReplyItem(text: string): QuickReplyItem {
  const label =
    text.length > QUICK_REPLY_LABEL_MAX
      ? text.slice(0, QUICK_REPLY_LABEL_MAX - 1) + '…'
      : text;
  return {
    type: 'action',
    action: { type: 'message', label, text },
  };
}
