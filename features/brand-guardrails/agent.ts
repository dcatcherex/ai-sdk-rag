/**
 * Thin AI SDK adapter for brand-guardrails tools.
 * All logic lives in service.ts — this file only wires up tool() definitions.
 */

import { tool } from 'ai';
import type { AgentToolContext } from '@/features/tools/registry/types';
import { checkGuardrailsSchema } from './schema';
import { checkGuardrails } from './service';

export function createBrandGuardrailsAgentTools(
  ctx: Pick<AgentToolContext, 'userId'>,
) {
  const { userId } = ctx;

  return {
    check_brand_guardrails: tool({
      description:
        'Check if content violates brand guardrails — tone rules, banned phrases, compliance requirements. Returns violations with severity and suggestions.',
      inputSchema: checkGuardrailsSchema,
      async execute({ content, brandId }) {
        const result = await checkGuardrails(brandId, content, userId);
        return { success: true, ...result };
      },
    }),
  };
}
