import { z } from 'zod';

export const veoGenerationModeSchema = z.enum([
  'TEXT_2_VIDEO',
  'FIRST_AND_LAST_FRAMES_2_VIDEO',
  'REFERENCE_2_VIDEO',
]);
export type VeoGenerationMode = z.infer<typeof veoGenerationModeSchema>;

export const generateVideoInputSchema = z.object({
  prompt: z.string().default('').describe('Description of the video to generate'),
  model: z.string().min(1).default('veo3_fast'),
  // Veo-specific
  generationMode: veoGenerationModeSchema.optional().default('TEXT_2_VIDEO'),
  aspectRatio: z.string().optional(),
  imageUrls: z.array(z.string()).optional(),
  seeds: z.number().int().min(10000).max(99999).optional(),
  // Standard models (Sora, Kling)
  duration: z.enum(['6', '10', '15', '25']).optional(),
  quality: z.string().optional(),
  resolution: z.string().optional(),
});

export type GenerateVideoInput = z.infer<typeof generateVideoInputSchema>;

export const triggerVideoResultSchema = z.object({
  taskId: z.string(),
  generationId: z.string(),
});

export type TriggerVideoResult = z.infer<typeof triggerVideoResultSchema>;
