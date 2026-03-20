import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { refundGenerationCredits } from '@/lib/api/creditGate';
import { enforceRateLimit, enforceCredits } from '@/lib/api/routeGuards';
import { internalError } from '@/lib/api/errorResponse';
import { generateSpeechInputSchema, generateDialogueInputSchema } from '@/features/speech/schema';
import { triggerSpeechGeneration, triggerDialogueGeneration } from '@/features/speech/service';

/**
 * Speech Generation Route (ElevenLabs TTS & Dialogue)
 * Delegates to features/speech/service.ts for KIE task creation + DB persistence.
 * Status polling: /api/generate/status?id=<generationId>
 *
 * Models:
 * - elevenlabs/text-to-speech-multilingual-v2 (single voice TTS)
 * - elevenlabs/text-to-dialogue-v3            (multi-speaker dialogue)
 */

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

  const rateLimitResponse = await enforceRateLimit(userId);
  if (rateLimitResponse) return rateLimitResponse;

  const body = await req.json();
  const { modelId = 'elevenlabs/text-to-speech-multilingual-v2', ttsSettings, executionConfig } = body;
  const isDialogue = modelId === 'elevenlabs/text-to-dialogue-v3';

  // Credit check
  const creditResponse = await enforceCredits(userId, modelId);
  if (creditResponse) return creditResponse;

  try {
    if (isDialogue) {
      const parsed = generateDialogueInputSchema.safeParse(ttsSettings);
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid dialogue input' }, { status: 400 });
      }

      const { taskId, generationId } = await triggerDialogueGeneration(
        { ...parsed.data, promptTitle: executionConfig?.promptTitle },
        userId,
      );
      return NextResponse.json({ async: true, taskId, generationId, status: 'processing', type: 'speech' });
    } else {
      const parsed = generateSpeechInputSchema.safeParse({ ...ttsSettings, text: body.prompt });
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid speech input' }, { status: 400 });
      }

      const { taskId, generationId } = await triggerSpeechGeneration(
        { ...parsed.data, promptTitle: executionConfig?.promptTitle },
        userId,
      );
      return NextResponse.json({ async: true, taskId, generationId, status: 'processing', type: 'speech' });
    }
  } catch (error) {
    await refundGenerationCredits(userId, modelId).catch(() => {});
    return internalError(error, 'Speech Generation');
  }
}
