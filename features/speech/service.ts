import 'server-only';
import { getKieApiKey } from '@/lib/api/routeGuards';
import { buildKieCallbackUrl } from '@/lib/kie-callback';
import { createKieTtsTask, createKieDialogueTask } from '@/lib/providers/media/kie-speech-adapter';
import { createMediaRun } from '@/lib/generation/create-media-run';
import type { GenerateSpeechInput, GenerateDialogueInput, TriggerSpeechResult } from './schema';

/**
 * Canonical speech (TTS) generation logic.
 * Called by the API route and agent adapter.
 */
export async function triggerSpeechGeneration(
  params: GenerateSpeechInput & { promptTitle?: string },
  userId: string,
  options?: { threadId?: string; source?: string },
): Promise<TriggerSpeechResult> {
  const apiKey = getKieApiKey();
  if (!apiKey) throw new Error('KIE_API_KEY is not configured');

  const callbackUrl = buildKieCallbackUrl();
  const { taskId } = await createKieTtsTask(params, apiKey, callbackUrl);

  const { generationId } = await createMediaRun({
    toolSlug: 'speech',
    userId,
    threadId: options?.threadId,
    source: options?.source,
    inputJson: {
      prompt: params.text,
      modelId: 'elevenlabs/text-to-speech-multilingual-v2',
      ttsSettings: params,
      isDialogue: false,
      kieTaskId: taskId,
      kieProvider: 'kie',
      callbackUrl,
      promptTitle: params.promptTitle ?? params.text.substring(0, 50),
    },
  });

  return { taskId, generationId };
}

/**
 * Canonical dialogue generation logic.
 * Called by the API route and agent adapter.
 */
export async function triggerDialogueGeneration(
  params: GenerateDialogueInput & { promptTitle?: string },
  userId: string,
  options?: { threadId?: string; source?: string },
): Promise<TriggerSpeechResult> {
  const apiKey = getKieApiKey();
  if (!apiKey) throw new Error('KIE_API_KEY is not configured');

  const callbackUrl = buildKieCallbackUrl();
  const { taskId } = await createKieDialogueTask(params, apiKey, callbackUrl);

  const { generationId } = await createMediaRun({
    toolSlug: 'speech',
    userId,
    threadId: options?.threadId,
    source: options?.source,
    inputJson: {
      modelId: 'elevenlabs/text-to-dialogue-v3',
      ttsSettings: { dialogueLines: params.lines, stability: params.stability, languageCode: params.languageCode },
      isDialogue: true,
      kieTaskId: taskId,
      kieProvider: 'kie',
      callbackUrl,
      promptTitle: params.promptTitle ?? 'Dialogue',
    },
  });

  return { taskId, generationId };
}
