import { z } from 'zod';

export const veoModelSchema = z.enum(['veo3_fast', 'veo3']);
export type VeoModel = z.infer<typeof veoModelSchema>;

export const veoGenerationModeSchema = z.enum([
  'TEXT_2_VIDEO',
  'FIRST_AND_LAST_FRAMES_2_VIDEO',
  'REFERENCE_2_VIDEO',
]);
export type VeoGenerationMode = z.infer<typeof veoGenerationModeSchema>;

export const generateVideoInputSchema = z.object({
  prompt: z.string().min(1).describe('Description of the video to generate'),
  model: veoModelSchema.optional().default('veo3_fast'),
  generationMode: veoGenerationModeSchema.optional().default('TEXT_2_VIDEO'),
  aspectRatio: z.enum(['16:9', '9:16', 'Auto']).optional().default('16:9'),
  imageUrls: z.array(z.string()).optional().describe('Image URLs for frame control or reference modes'),
  seeds: z.number().int().min(10000).max(99999).optional().describe('Seed for reproducibility'),
});

export type GenerateVideoInput = z.infer<typeof generateVideoInputSchema>;

export const triggerVideoResultSchema = z.object({
  taskId: z.string(),
  generationId: z.string(),
});

export type TriggerVideoResult = z.infer<typeof triggerVideoResultSchema>;
