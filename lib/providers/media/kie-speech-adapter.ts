import 'server-only';
import { KieService } from '@/lib/providers/kieService';
import type { MediaTaskResult } from './types';

type TtsAdapterInput = {
  text: string;
  voice?: string;
  stability?: number;
  similarityBoost?: number;
  style?: number;
  speed?: number;
};

type DialogueAdapterInput = {
  lines: Array<{ text: string; voice: string }>;
  stability?: number;
  languageCode?: string;
};

/**
 * Create a KIE ElevenLabs TTS task.
 * Feature services call this instead of importing KieService directly.
 */
export async function createKieTtsTask(
  params: TtsAdapterInput,
  apiKey: string,
  callbackUrl: string | null,
): Promise<MediaTaskResult> {
  return KieService.createTtsTask({
    text: params.text,
    voice: params.voice,
    stability: params.stability,
    similarityBoost: params.similarityBoost,
    style: params.style,
    speed: params.speed,
  }, apiKey, { callbackUrl });
}

/**
 * Create a KIE ElevenLabs Dialogue task.
 * Feature services call this instead of importing KieService directly.
 */
export async function createKieDialogueTask(
  params: DialogueAdapterInput,
  apiKey: string,
  callbackUrl: string | null,
): Promise<MediaTaskResult> {
  return KieService.createDialogueTask({
    dialogue: params.lines,
    stability: params.stability,
    languageCode: params.languageCode,
  }, apiKey, { callbackUrl });
}
