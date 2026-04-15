import 'server-only';
import { KieService } from '@/lib/providers/kieService';
import type { MediaTaskResult } from './types';

type SunoVersion = 'V3_5' | 'V4' | 'V4_5' | 'V4_5PLUS' | 'V4_5ALL' | 'V5';

const SUNO_MODEL_MAP: Record<string, SunoVersion> = {
  'suno-v4': 'V4',
  'suno-v4.5': 'V4_5',
  'suno-v5': 'V5',
};

type AudioAdapterInput = {
  prompt: string;
  model?: string;
  customMode?: boolean;
  instrumental?: boolean;
  style?: string;
  title?: string;
  negativeTags?: string;
  vocalGender?: 'm' | 'f';
  styleWeight?: number;
  weirdnessConstraint?: number;
  audioWeight?: number;
};

/**
 * Create a KIE Suno music generation task.
 * Feature services call this instead of importing KieService directly.
 * Returns both the taskId and the resolved Suno model variant for logging.
 */
export async function createKieAudioTask(
  params: AudioAdapterInput,
  apiKey: string,
): Promise<MediaTaskResult & { sunoModel: SunoVersion }> {
  const { prompt, model = 'suno-v4.5', customMode = false, instrumental = false } = params;
  const sunoModel = SUNO_MODEL_MAP[model] ?? 'V4_5';

  const result = await KieService.createSunoTask({
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

  return { taskId: result.taskId, sunoModel };
}
