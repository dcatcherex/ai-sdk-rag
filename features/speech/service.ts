import 'server-only';
import { nanoid } from 'nanoid';
import { db } from '@/lib/db';
import { toolRun } from '@/db/schema';
import { getKieApiKey } from '@/lib/api/routeGuards';
import { KieService } from '@/lib/providers/kieService';
import type { GenerateSpeechInput, GenerateDialogueInput, TriggerSpeechResult } from './schema';

/**
 * Canonical speech (TTS) generation logic.
 * Called by the API route and agent adapter.
 */
export async function triggerSpeechGeneration(
  params: GenerateSpeechInput & { promptTitle?: string },
  userId: string,
): Promise<TriggerSpeechResult> {
  const apiKey = getKieApiKey();
  if (!apiKey) throw new Error('KIE_API_KEY is not configured');

  const { taskId } = await KieService.createTtsTask({
    text: params.text,
    voice: params.voice,
    stability: params.stability,
    similarityBoost: params.similarityBoost,
    style: params.style,
    speed: params.speed,
  }, apiKey);

  const [record] = await db.insert(toolRun).values({
    id: nanoid(),
    toolSlug: 'speech',
    userId,
    source: 'api',
    status: 'pending',
    inputJson: {
      prompt: params.text,
      modelId: 'elevenlabs/text-to-speech-multilingual-v2',
      ttsSettings: params,
      isDialogue: false,
      kieTaskId: taskId,
      kieProvider: 'kie',
      promptTitle: params.promptTitle ?? params.text.substring(0, 50),
    },
  }).returning();

  return { taskId, generationId: record.id };
}

/**
 * Canonical dialogue generation logic.
 * Called by the API route and agent adapter.
 */
export async function triggerDialogueGeneration(
  params: GenerateDialogueInput & { promptTitle?: string },
  userId: string,
): Promise<TriggerSpeechResult> {
  const apiKey = getKieApiKey();
  if (!apiKey) throw new Error('KIE_API_KEY is not configured');

  const { taskId } = await KieService.createDialogueTask({
    dialogue: params.lines,
    stability: params.stability,
    languageCode: params.languageCode,
  }, apiKey);

  const [record] = await db.insert(toolRun).values({
    id: nanoid(),
    toolSlug: 'speech',
    userId,
    source: 'api',
    status: 'pending',
    inputJson: {
      modelId: 'elevenlabs/text-to-dialogue-v3',
      ttsSettings: { dialogueLines: params.lines, stability: params.stability, languageCode: params.languageCode },
      isDialogue: true,
      kieTaskId: taskId,
      kieProvider: 'kie',
      promptTitle: params.promptTitle ?? 'Dialogue',
    },
  }).returning();

  return { taskId, generationId: record.id };
}
