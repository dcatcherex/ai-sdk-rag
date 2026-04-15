import 'server-only';
import { getKieApiKey } from '@/lib/api/routeGuards';
import { createKieAudioTask } from '@/lib/providers/media/kie-audio-adapter';
import { createMediaRun } from '@/lib/generation/create-media-run';
import type { GenerateMusicInput, TriggerAudioResult } from './schema';

/**
 * Canonical audio generation logic.
 * Called by the API route and agent adapter.
 * Creates a KIE Suno task and inserts a pending toolRun record.
 */
export async function triggerAudioGeneration(
  params: GenerateMusicInput & { promptTitle?: string },
  userId: string,
  options?: { threadId?: string; source?: string },
): Promise<TriggerAudioResult> {
  const apiKey = getKieApiKey();
  if (!apiKey) throw new Error('KIE_API_KEY is not configured');

  const { prompt, model = 'suno-v4.5' } = params;

  const { taskId, sunoModel } = await createKieAudioTask(params, apiKey);

  const { generationId } = await createMediaRun({
    toolSlug: 'audio',
    userId,
    threadId: options?.threadId,
    source: options?.source,
    inputJson: {
      prompt,
      modelId: model,
      audioSettings: params,
      kieTaskId: taskId,
      kieProvider: 'kie',
      sunoModel,
      promptTitle: params.promptTitle ?? prompt.substring(0, 50),
    },
  });

  return { taskId, generationId };
}
