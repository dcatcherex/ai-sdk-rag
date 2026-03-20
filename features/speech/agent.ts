/**
 * Thin AI SDK adapter for speech (TTS + dialogue) generation.
 * Option B: fire + redirect — starts generation and returns a link to the tool page.
 * All business logic lives in service.ts.
 */

import { tool } from 'ai';
import type { AgentToolContext } from '@/features/tools/registry/types';
import { generateSpeechInputSchema, generateDialogueInputSchema } from './schema';
import { triggerSpeechGeneration, triggerDialogueGeneration } from './service';

export function createSpeechAgentTools(ctx: Pick<AgentToolContext, 'userId'>) {
  const { userId } = ctx;

  return {
    generate_speech: tool({
      description:
        'Convert text to speech using ElevenLabs. Accepts text and optional voice/style settings. ' +
        'Starts the generation and returns a link where the user can track progress and play the audio. ' +
        'Use this when the user asks to read aloud, narrate, or create a voiceover for a single speaker.',
      inputSchema: generateSpeechInputSchema,
      async execute(params) {
        const { taskId, generationId } = await triggerSpeechGeneration(
          { ...params, promptTitle: params.text.substring(0, 50) },
          userId,
        );
        return {
          started: true,
          taskId,
          generationId,
          message:
            `Speech generation started. Track progress and play the audio at: /tools/speech?id=${generationId}`,
        };
      },
    }),

    generate_dialogue: tool({
      description:
        'Generate a multi-speaker dialogue using ElevenLabs. Accepts an array of lines each with a speaker voice ID and text. ' +
        'Starts the generation and returns a link where the user can track progress and play the audio. ' +
        'Use this when the user asks to create a conversation, podcast, or multi-voice audio clip.',
      inputSchema: generateDialogueInputSchema,
      async execute(params) {
        const { taskId, generationId } = await triggerDialogueGeneration(
          { ...params, promptTitle: 'Dialogue' },
          userId,
        );
        return {
          started: true,
          taskId,
          generationId,
          message:
            `Dialogue generation started. Track progress and play the audio at: /tools/speech?id=${generationId}`,
        };
      },
    }),
  };
}
