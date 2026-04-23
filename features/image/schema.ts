import { z } from 'zod';

export const generateImageInputSchema = z.object({
  prompt: z.string().min(1).max(20000).describe('Text description of the image to generate'),
  modelId: z.string().default('nano-banana-2'),
  aspectRatio: z.string().optional().describe('Aspect ratio, e.g. "16:9", "1:1"'),
  quality: z.enum(['medium', 'high']).optional().describe('Generation quality (GPT Image models)'),
  enablePro: z.boolean().optional().describe('Enable pro/quality mode (Grok Imagine models)'),
  resolution: z.enum(['1K', '2K', '4K']).optional().describe('Output resolution (Nano Banana 2)'),
  googleSearch: z.boolean().optional().describe('Use Google Search grounding (Nano Banana 2)'),
  outputFormat: z.enum(['jpg', 'png', 'jpeg']).optional(),
  seed: z.number().optional().describe('Seed for reproducibility (Qwen models)'),
  imageUrls: z.array(z.string()).optional().describe('Source image URLs or base64 for editing models'),
  taskHint: z.string().optional().describe('Task type hint for stock pool matching'),
  promptTitle: z.string().optional(),
});

export type GenerateImageInput = z.infer<typeof generateImageInputSchema>;

export const triggerImageResultSchema = z.object({
  taskId: z.string(),
  generationId: z.string(),
});

export type TriggerImageResult = z.infer<typeof triggerImageResultSchema>;
