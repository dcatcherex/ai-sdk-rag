import { generateFollowUpSuggestions } from '@/lib/follow-up-suggestions';
import type { FollowUpOptions } from '@/lib/follow-up-suggestions';

export function generateLineFollowUpSuggestions(
  conversationContext: string,
  options: Omit<FollowUpOptions, 'maxChars' | 'model'> = {},
): Promise<string[]> {
  return generateFollowUpSuggestions(conversationContext, {
    maxChars: 20,   // LINE button label limit
    ...options,
  });
}
