/**
 * Thin AI SDK adapter for video generation.
 * Option B: fire + redirect — starts generation and returns a link to the tool page.
 * All business logic lives in service.ts.
 */

import { tool } from 'ai';
import type { AgentToolContext } from '@/features/tools/registry/types';
import { generateVideoInputSchema } from './schema';
import { triggerVideoGeneration } from './service';

export function createVideoAgentTools(ctx: Pick<AgentToolContext, 'userId'>) {
  const { userId } = ctx;

  return {
    generate_video: tool({
      description:
        'Generate an AI video using Google Veo. Accepts a text prompt and optional mode/aspect ratio settings. ' +
        'Supports text-to-video, first+last frame control, and reference image modes. ' +
        'Starts the generation and returns a link where the user can track progress and view the result. ' +
        'Use this when the user asks to create, generate, or animate a video clip.',
      inputSchema: generateVideoInputSchema,
      async execute(params) {
        const { taskId, generationId } = await triggerVideoGeneration(
          { ...params, promptTitle: params.prompt.substring(0, 50) },
          userId,
        );
        return {
          started: true,
          taskId,
          generationId,
          message:
            `Video generation started. Track progress and view the result at: /tools/video?id=${generationId}`,
        };
      },
    }),
  };
}
