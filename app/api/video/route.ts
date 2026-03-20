import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { refundGenerationCredits } from '@/lib/api/creditGate';
import { enforceRateLimit, enforceCredits } from '@/lib/api/routeGuards';
import { internalError } from '@/lib/api/errorResponse';
import { KIE_VIDEO_MODELS } from '@/lib/models/kie-video';
import { generateVideoInputSchema } from '@/features/video/schema';
import { triggerVideoGeneration } from '@/features/video/service';

/**
 * Video Generation Route
 * Delegates to features/video/service.ts for KIE task creation + DB persistence.
 * Status polling: /api/generate/status?id=<generationId>
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
  const { modelId = 'veo3_fast', videoSettings, executionConfig } = body;

  // Validate input
  const parsed = generateVideoInputSchema.safeParse({
    prompt: body.prompt,
    model: modelId,
    ...videoSettings,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
  }

  const params = parsed.data;
  const generationMode = params.generationMode ?? 'TEXT_2_VIDEO';

  // Image presence check for frame/reference modes
  if (generationMode === 'FIRST_AND_LAST_FRAMES_2_VIDEO' && (!params.imageUrls?.length)) {
    return NextResponse.json({ error: 'Frame Control mode requires at least 1 image (first frame).' }, { status: 400 });
  }
  if (generationMode === 'REFERENCE_2_VIDEO' && (!params.imageUrls?.length)) {
    return NextResponse.json({ error: 'Reference mode requires at least 1 reference image.' }, { status: 400 });
  }

  // Prompt length check
  const modelDef = KIE_VIDEO_MODELS.find(m => m.id === modelId);
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
    const { taskId, generationId } = await triggerVideoGeneration(
      { ...params, promptTitle: executionConfig?.promptTitle },
      userId,
    );

    return NextResponse.json({ async: true, taskId, generationId, status: 'processing', type: 'video' });
  } catch (error) {
    await refundGenerationCredits(userId, modelId).catch(() => {});
    return internalError(error, 'Video Generation');
  }
}
