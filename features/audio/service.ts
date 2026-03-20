import 'server-only';
import { nanoid } from 'nanoid';
import { db } from '@/lib/db';
import { toolRun } from '@/db/schema';
import { getKieApiKey } from '@/lib/api/routeGuards';
import { KieService } from '@/lib/providers/kieService';
import type { GenerateMusicInput, TriggerAudioResult } from './schema';

const SUNO_MODEL_MAP: Record<string, 'V3_5' | 'V4' | 'V4_5' | 'V4_5PLUS' | 'V4_5ALL' | 'V5'> = {
  'suno-v4': 'V4',
  'suno-v4.5': 'V4_5',
  'suno-v5': 'V5',
};

/**
 * Canonical audio generation logic.
 * Called by the API route and agent adapter.
 * Creates a KIE Suno task and inserts a pending toolRun record.
 */
export async function triggerAudioGeneration(
  params: GenerateMusicInput & { promptTitle?: string },
  userId: string,
): Promise<TriggerAudioResult> {
  const apiKey = getKieApiKey();
  if (!apiKey) throw new Error('KIE_API_KEY is not configured');

  const { prompt, model = 'suno-v4.5', customMode = false, instrumental = false } = params;
  const sunoModel = SUNO_MODEL_MAP[model] ?? 'V4_5';

  const { taskId } = await KieService.createSunoTask({
    prompt,
    customMode,
    instrumental,
    model: sunoModel,
    style: customMode ? params.style : undefined,
    title: customMode ? params.title : undefined,
    negativeTags: params.negativeTags,
    vocalGender: !instrumental ? params.vocalGender : undefined,
    styleWeight: params.styleWeight,
    weirdnessConstraint: params.weirdnessConstraint,
    audioWeight: params.audioWeight,
  }, apiKey);

  const [record] = await db.insert(toolRun).values({
    id: nanoid(),
    toolSlug: 'audio',
    userId,
    source: 'api',
    status: 'pending',
    inputJson: {
      prompt,
      modelId: model,
      audioSettings: params,
      kieTaskId: taskId,
      kieProvider: 'kie',
      sunoModel,
      promptTitle: params.promptTitle ?? prompt.substring(0, 50),
    },
  }).returning();

  return { taskId, generationId: record.id };
}
