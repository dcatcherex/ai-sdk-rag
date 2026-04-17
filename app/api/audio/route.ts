import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from "@/lib/auth-server";
import { refundGenerationCredits } from '@/lib/api/creditGate';
import { enforceRateLimit, enforceCredits } from '@/lib/api/routeGuards';
import { internalError } from '@/lib/api/errorResponse';
import { KIE_AUDIO_MODELS } from '@/lib/models/kie-audio';
import { generateMusicInputSchema } from '@/features/audio/schema';
import { triggerAudioGeneration } from '@/features/audio/service';

/**
 * Audio/Music Generation Route
 * Delegates to features/audio/service.ts for KIE task creation + DB persistence.
 * Status polling: /api/generate/status?id=<generationId>
 */

export async function POST(req: NextRequest) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;
  const userId = authResult.user.id;

  const rateLimitResponse = await enforceRateLimit(userId);
  if (rateLimitResponse) return rateLimitResponse;

  const body = await req.json();
  const { modelId = 'suno-v4.5', executionConfig } = body;

  // Validate input
  const parsed = generateMusicInputSchema.safeParse({ ...body.audioSettings, prompt: body.prompt, model: modelId });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
  }

  const params = parsed.data;

  // Prompt length check
  const modelDef = KIE_AUDIO_MODELS.find(m => m.id === modelId);
  if (modelDef?.maxPromptLength && params.prompt.length > modelDef.maxPromptLength) {
    return NextResponse.json(
      {
        error: `Prompt too long: ${params.prompt.length} chars exceeds ${modelDef.maxPromptLength} limit for ${modelDef.name}.`,
        lengthInfo: { current: params.prompt.length, limit: modelDef.maxPromptLength },
      },
      { status: 400 },
    );
  }

  // Credit check
  const creditResponse = await enforceCredits(userId, modelId);
  if (creditResponse) return creditResponse;

  try {
    const { taskId, generationId } = await triggerAudioGeneration(
      { ...params, promptTitle: executionConfig?.promptTitle },
      userId,
    );

    return NextResponse.json({ async: true, taskId, generationId, status: 'processing', type: 'audio' });
  } catch (error) {
    await refundGenerationCredits(userId, modelId).catch(() => {});
    return internalError(error, 'Audio Generation');
  }
}
