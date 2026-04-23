import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from "@/lib/auth-server";
import { refundGenerationCredits } from '@/lib/api/creditGate';
import { enforceRateLimit, enforceCredits } from '@/lib/api/routeGuards';
import { internalError } from '@/lib/api/errorResponse';
import { generateImageInputSchema } from '@/features/image/schema';
import { triggerImageGeneration } from '@/features/image/service';
import { IMAGE_MODEL_CONFIGS, resolveImageCredits } from '@/features/image/types';
import { buildBrandImageContext, getBrand } from '@/features/brands/service';

/**
 * Image Generation Route (KIE)
 * Delegates to features/image/service.ts for KIE task creation + DB persistence.
 * Status polling: /api/generate/status?taskId=<taskId>&generationId=<id>
 */

export async function POST(req: NextRequest) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;
  const userId = authResult.user.id;

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
  let effectiveImageUrls = params.imageUrls;

  if (params.brandId) {
    const accessibleBrand = await getBrand(userId, params.brandId);
    if (!accessibleBrand) {
      return NextResponse.json(
        { error: 'Brand not found or not accessible.' },
        { status: 403 },
      );
    }

    const { logoUrl } = await buildBrandImageContext(accessibleBrand.id);
    if (logoUrl && !effectiveImageUrls?.includes(logoUrl)) {
      effectiveImageUrls = [...(effectiveImageUrls ?? []), logoUrl];
    }
  }

  // Resolve the correct credit cost based on the user's selected resolution/quality
  const modelConfig = IMAGE_MODEL_CONFIGS.find(m => m.id === params.modelId);
  const resolvedCost = modelConfig
    ? resolveImageCredits(modelConfig, { resolution: params.resolution, quality: params.quality })
    : undefined;

  const creditResponse = await enforceCredits(userId, params.modelId, resolvedCost);
  if (creditResponse) return creditResponse;

  try {
    const { taskId, generationId } = await triggerImageGeneration(
      { ...params, imageUrls: effectiveImageUrls, promptTitle: body.promptTitle },
      userId,
    );
    return NextResponse.json({ async: true, taskId, generationId, status: 'processing', type: 'image' });
  } catch (error) {
    await refundGenerationCredits(userId, params.modelId, resolvedCost).catch(() => {});
    return internalError(error, 'Image Generation');
  }
}
