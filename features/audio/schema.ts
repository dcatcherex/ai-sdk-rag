import { z } from 'zod';

export const sunoModelSchema = z.enum(['suno-v4', 'suno-v4.5', 'suno-v5']);
export type SunoModel = z.infer<typeof sunoModelSchema>;

export const generateMusicInputSchema = z.object({
  prompt: z.string().min(1).describe('Lyrics or description of the music to generate'),
  model: sunoModelSchema.optional().default('suno-v4.5'),
  customMode: z.boolean().optional().default(false).describe('Enable custom mode for manual style/title control'),
  style: z.string().optional().describe('Musical style, e.g. "lo-fi hip hop" (custom mode only)'),
  title: z.string().optional().describe('Song title (custom mode only)'),
  instrumental: z.boolean().optional().default(false).describe('Generate without vocals'),
  vocalGender: z.enum(['m', 'f']).optional().describe('Preferred vocal gender (ignored when instrumental)'),
  negativeTags: z.string().optional().describe('Styles to avoid, e.g. "heavy metal, distortion"'),
  styleWeight: z.number().min(0).max(1).optional().describe('How strongly the style is applied (0–1)'),
  weirdnessConstraint: z.number().min(0).max(1).optional().describe('How experimental the output is (0–1)'),
  audioWeight: z.number().min(0).max(1).optional().describe('Weight of audio vs lyrics (0–1)'),
});

export type GenerateMusicInput = z.infer<typeof generateMusicInputSchema>;

export const triggerAudioResultSchema = z.object({
  taskId: z.string(),
  generationId: z.string(),
});

export type TriggerAudioResult = z.infer<typeof triggerAudioResultSchema>;
