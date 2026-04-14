import { tool } from 'ai';
import type { AgentToolContext } from '@/features/tools/registry/types';
import {
  createGoogleSlidesDeckInputSchema,
  createGoogleSlidesFromTemplateInputSchema,
} from './schema';
import {
  runCreateGoogleSlidesDeck,
  runCreateGoogleSlidesFromTemplate,
} from './service';

export function createGoogleSlidesAgentTools(
  ctx: Pick<AgentToolContext, 'userId'>,
) {
  const { userId } = ctx;

  return {
    create_google_slides_deck: tool({
      description:
        'Create a Google Slides deck from a structured outline of slide titles, bullets, and optional speaker notes.',
      inputSchema: createGoogleSlidesDeckInputSchema,
      needsApproval: true,
      async execute(input) {
        return await runCreateGoogleSlidesDeck(input, userId);
      },
    }),

    create_google_slides_from_template: tool({
      description:
        'Copy a Google Slides template presentation and append generated slides that follow the copied theme.',
      inputSchema: createGoogleSlidesFromTemplateInputSchema,
      needsApproval: true,
      async execute(input) {
        return await runCreateGoogleSlidesFromTemplate(input, userId);
      },
    }),
  };
}
