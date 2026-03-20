import { z } from 'zod';

export const ttsModelSchema = z.enum([
  'elevenlabs/text-to-speech-multilingual-v2',
  'elevenlabs/text-to-dialogue-v3',
]);
export type TtsModel = z.infer<typeof ttsModelSchema>;

export const dialogueLineSchema = z.object({
  text: z.string().min(1),
  voice: z.string().min(1),
});

export const generateSpeechInputSchema = z.object({
  text: z.string().min(1).describe('Text to convert to speech'),
  voice: z.string().optional().default('BIvP0GN1cAtSRTxNHnWS').describe('ElevenLabs voice ID'),
  stability: z.number().min(0).max(1).optional().describe('Voice stability (0–1, default 0.5)'),
  similarityBoost: z.number().min(0).max(1).optional().describe('Similarity boost (0–1, default 0.75)'),
  style: z.number().min(0).max(1).optional().describe('Style exaggeration (0–1, default 0)'),
  speed: z.number().min(0.7).max(1.2).optional().describe('Speaking speed (0.7–1.2, default 1)'),
});

export const generateDialogueInputSchema = z.object({
  lines: z.array(dialogueLineSchema).min(1).describe('Dialogue lines with speaker and text'),
  stability: z.number().min(0).max(1).optional(),
  languageCode: z.string().optional().describe('ISO 639-1 language code, e.g. "en"'),
});

export type GenerateSpeechInput = z.infer<typeof generateSpeechInputSchema>;
export type GenerateDialogueInput = z.infer<typeof generateDialogueInputSchema>;

export const triggerSpeechResultSchema = z.object({
  taskId: z.string(),
  generationId: z.string(),
});

export type TriggerSpeechResult = z.infer<typeof triggerSpeechResultSchema>;
