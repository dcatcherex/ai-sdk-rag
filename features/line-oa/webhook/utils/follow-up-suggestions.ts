import { generateFollowUpSuggestions } from '@/lib/follow-up-suggestions';

export function generateLineFollowUpSuggestions(
  conversationContext: string,
): Promise<string[]> {
  return generateFollowUpSuggestions(conversationContext, {
    maxChars: 20,   // LINE button label limit
  });
}
