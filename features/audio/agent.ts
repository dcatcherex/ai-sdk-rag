/**
 * Thin AI SDK adapter for audio (music) generation.
 * Option B: fire + redirect — starts generation and returns a link to the tool page.
 * All business logic lives in service.ts.
 */

import { tool } from 'ai';
import type { AgentToolContext } from '@/features/tools/registry/types';
import { generateMusicInputSchema } from './schema';
import { triggerAudioGeneration } from './service';

export function createAudioAgentTools(ctx: Pick<AgentToolContext, 'userId'>) {
  const { userId } = ctx;

  return {
    generate_music: tool({
      description:
        'Generate an AI music track using Suno. Accepts a lyrics/style prompt and optional settings. ' +
        'Starts the generation and returns a link where the user can track progress and listen to the result. ' +
        'Use this when the user asks to create, compose, or generate music or a song.',
      inputSchema: generateMusicInputSchema,
      async execute(params) {
        const { taskId, generationId } = await triggerAudioGeneration(
          { ...params, promptTitle: params.prompt.substring(0, 50) },
          userId,
        );
        return {
          started: true,
          taskId,
          generationId,
          message:
            `Music generation started. Track progress and listen to the result at: /tools/audio?id=${generationId}`,
        };
      },
    }),
  };
}
