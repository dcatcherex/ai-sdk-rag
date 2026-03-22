import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { refundGenerationCredits } from '@/lib/api/creditGate';
import { enforceRateLimit, enforceCredits } from '@/lib/api/routeGuards';
import { internalError } from '@/lib/api/errorResponse';
import { generateImageInputSchema } from '@/features/image/schema';
import { triggerImageGeneration } from '@/features/image/service';

/**
 * Image Generation Route (KIE)
 * Delegates to features/image/service.ts for KIE task creation + DB persistence.
 * Status polling: /api/generate/status?taskId=<taskId>&generationId=<id>
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
  const parsed = generateImageInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 },
    );
  }

  const params = parsed.data;

  const creditResponse = await enforceCredits(userId, params.modelId);
  if (creditResponse) return creditResponse;

  try {
    const { taskId, generationId } = await triggerImageGeneration(
      { ...params, promptTitle: body.promptTitle },
      userId,
    );
    return NextResponse.json({ async: true, taskId, generationId, status: 'processing', type: 'image' });
  } catch (error) {
    await refundGenerationCredits(userId, params.modelId).catch(() => {});
    return internalError(error, 'Image Generation');
  }
}
