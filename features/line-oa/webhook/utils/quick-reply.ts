import type { QuickReplyItem } from '../types';
import { QUICK_REPLY_LABEL_MAX } from '../types';

/**
 * Build a message-action quick reply button.
 * Label is truncated to LINE's 20-char limit.
 * The full text is sent as the user's message when tapped.
 */
export function buildQuickReplyItem(text: string, labelText?: string): QuickReplyItem {
  const displayText = labelText ?? text;
  const label =
    displayText.length > QUICK_REPLY_LABEL_MAX
      ? `${displayText.slice(0, QUICK_REPLY_LABEL_MAX - 3)}...`
      : displayText;

  return {
    type: 'action',
    action: { type: 'message', label, text },
  };
}
