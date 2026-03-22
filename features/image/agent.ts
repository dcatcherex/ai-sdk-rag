/**
 * Thin AI SDK adapter for image generation.
 * Option B: fire + redirect — starts generation and returns a link to the tool page.
 * All business logic lives in service.ts.
 */

import { tool } from 'ai';
import { z } from 'zod';
import type { AgentToolContext } from '@/features/tools/registry/types';
import { triggerImageGeneration } from './service';

export function createImageAgentTools(ctx: Pick<AgentToolContext, 'userId'>) {
  const { userId } = ctx;

  return {
    generate_image: tool({
      description:
        'Generate or edit an image using KIE AI models (Nano Banana 2, GPT Image 1.5, Qwen Z-Image, Grok Imagine, etc.). ' +
        'For best results include: subject, composition, action, location, and style in the prompt. ' +
        'Starts the generation and returns a link where the user can view and download the result. ' +
        'Use this when the user asks to create, draw, generate, or edit an image.',
      inputSchema: z.object({
        prompt: z.string().min(1).describe('Detailed image description. Include subject, style, composition, location.'),
        modelId: z.enum([
          'nano-banana-2',
          'gpt-image/1.5-text-to-image',
          'gpt-image/1.5-image-to-image',
          'z-image',
          'qwen/image-edit',
          'grok-imagine/text-to-image',
        ]).optional().default('nano-banana-2').describe('Model to use. Default: nano-banana-2'),
        aspectRatio: z.string().optional().describe('Aspect ratio e.g. "16:9", "1:1", "9:16"'),
        quality: z.enum(['medium', 'high']).optional().describe('Quality for GPT Image models'),
      }),
      async execute(params) {
        const { taskId, generationId } = await triggerImageGeneration(
          { ...params, promptTitle: params.prompt.substring(0, 50) },
          userId,
        );
        return {
          started: true,
          taskId,
          generationId,
          message: `Image generation started. View and download the result at: /tools/image?id=${generationId}&taskId=${taskId}`,
        };
      },
    }),
  };
}
