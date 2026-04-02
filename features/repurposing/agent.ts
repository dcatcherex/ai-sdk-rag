/**
 * Thin AI SDK adapter for content repurposing tools.
 * All logic lives in service.ts — this file only wires up tool() definitions.
 */

import { tool } from 'ai';
import type { AgentToolContext } from '@/features/tools/registry/types';
import { repurposeInputSchema } from './schema';
import { repurposeContent } from './service';

export function createRepurposingAgentTools(ctx: Pick<AgentToolContext, 'userId'>) {
  const { userId } = ctx;

  return {
    repurpose_content: tool({
      description:
        'Repurpose existing content into multiple formats (blog post, newsletter, LinkedIn post, tweet thread, social caption, ad copy, email sequence). Automatically saves each repurposed variant.',
      inputSchema: repurposeInputSchema,
      async execute(input) {
        const pieces = await repurposeContent(userId, input);
        return { success: true, pieces, count: pieces.length };
      },
    }),
  };
}
