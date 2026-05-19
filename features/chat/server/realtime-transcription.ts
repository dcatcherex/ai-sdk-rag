import { createHash } from 'crypto';
import { z } from 'zod';

export const realtimeTranscriptionSessionRequestSchema = z.object({
  language: z.string().trim().min(1).max(16).optional(),
  latencyMode: z.enum(['fast', 'balanced', 'accurate']).optional(),
});

export type RealtimeTranscriptionLatencyMode =
  z.infer<typeof realtimeTranscriptionSessionRequestSchema>['latencyMode'];

const DEFAULT_REALTIME_TRANSCRIPTION_MODEL = 'gpt-realtime-whisper';

export function hashRealtimeSafetyIdentifier(userId: string) {
  return createHash('sha256').update(userId).digest('hex');
}

export function resolveOpenAIRealtimeTranscriptionModel() {
  return process.env.OPENAI_REALTIME_TRANSCRIPTION_MODEL?.trim()
    || DEFAULT_REALTIME_TRANSCRIPTION_MODEL;
}

function supportsRealtimeTurnDetection(model: string) {
  return model !== 'gpt-realtime-whisper';
}

function resolveTurnDetection(latencyMode?: RealtimeTranscriptionLatencyMode) {
  switch (latencyMode) {
    case 'fast':
      return {
        type: 'server_vad' as const,
        threshold: 0.45,
        prefix_padding_ms: 200,
        silence_duration_ms: 350,
      };
    case 'accurate':
      return {
        type: 'server_vad' as const,
        threshold: 0.55,
        prefix_padding_ms: 400,
        silence_duration_ms: 800,
      };
    case 'balanced':
    default:
      return {
        type: 'server_vad' as const,
        threshold: 0.5,
        prefix_padding_ms: 300,
        silence_duration_ms: 500,
      };
  }
}

export function buildRealtimeTranscriptionSessionConfig(input: {
  language?: string;
  latencyMode?: RealtimeTranscriptionLatencyMode;
}) {
  const language = input.language?.trim();
  const model = resolveOpenAIRealtimeTranscriptionModel();

  return {
    type: 'transcription' as const,
    audio: {
      input: {
        transcription: {
          model,
          ...(language ? { language } : {}),
        },
        ...(supportsRealtimeTurnDetection(model)
          ? { turn_detection: resolveTurnDetection(input.latencyMode) }
          : {}),
      },
    },
  };
}
