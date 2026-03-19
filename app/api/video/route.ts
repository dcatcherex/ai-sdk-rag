import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { refundGenerationCredits } from '@/lib/api/creditGate';
import { enforceRateLimit, enforceCredits, getKieApiKey } from '@/lib/api/routeGuards';
import { internalError } from '@/lib/api/errorResponse';

/**
 * Video Generation Route
 * Uses KIE's Veo 3.1 endpoint (/api/v1/veo/generate) with async polling flow
 */

export async function POST(req: NextRequest) {
    const { userId } = await auth();
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rateLimitResponse = await enforceRateLimit(userId);
    if (rateLimitResponse) return rateLimitResponse;

    const body = await req.json();
    const {
        prompt,
        modelId = 'veo3_fast',
        videoSettings,
        executionConfig,
    } = body;

    try {

        // Validate prompt
        if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
            return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
        }

        // Validate prompt length before deducting credits
        const { AVAILABLE_MODELS } = await import('@/services/aiService');
        const modelDef = AVAILABLE_MODELS.find(m => m.id === modelId);

        if (modelDef?.maxPromptLength && prompt.length > modelDef.maxPromptLength) {
            return NextResponse.json(
                {
                    error: `Prompt too long: ${prompt.length} characters exceeds ${modelDef.maxPromptLength} character limit for ${modelDef.name}.`,
                    type: 'text',
                    lengthInfo: {
                        current: prompt.length,
                        limit: modelDef.maxPromptLength,
                        over: prompt.length - modelDef.maxPromptLength
                    }
                },
                { status: 400 }
            );
        }

        // Credit check (after validation to avoid charging for invalid requests)
        const creditResponse = await enforceCredits(userId, modelId);
        if (creditResponse) return creditResponse;

        // --- KIE Veo 3.1 ---
        const { KieService } = await import('@/services/kieService');
        const apiKey = getKieApiKey();
        if (!apiKey) {
            return NextResponse.json(
                { error: 'KIE_API_KEY is not configured. Please add it to your .env.local file.' },
                { status: 500 }
            );
        }

        // Extract video settings
        const generationMode = videoSettings?.generationMode || 'TEXT_2_VIDEO';
        const imageUrls: string[] | undefined = videoSettings?.imageUrls;
        const seeds: number | undefined = videoSettings?.seeds;

        // Map modelId to Veo model param
        // Reference mode forces veo3_fast
        let veoModel: 'veo3' | 'veo3_fast' = modelId === 'veo3' ? 'veo3' : 'veo3_fast';
        if (generationMode === 'REFERENCE_2_VIDEO') {
            veoModel = 'veo3_fast';
        }

        // Map aspect ratio — Veo supports 16:9, 9:16, Auto
        // Reference mode forces 16:9
        const rawAspect = videoSettings?.aspectRatio || '16:9';
        let veoAspect: '16:9' | '9:16' | 'Auto' =
            rawAspect === '9:16' ? '9:16' :
            rawAspect === 'Auto' ? 'Auto' : '16:9';
        if (generationMode === 'REFERENCE_2_VIDEO') {
            veoAspect = '16:9';
        }

        // Validate image requirements per mode
        if (generationMode === 'FIRST_AND_LAST_FRAMES_2_VIDEO' && (!imageUrls || imageUrls.length === 0)) {
            return NextResponse.json(
                { error: 'Frame Control mode requires at least 1 image (first frame).' },
                { status: 400 }
            );
        }
        if (generationMode === 'REFERENCE_2_VIDEO' && (!imageUrls || imageUrls.length === 0)) {
            return NextResponse.json(
                { error: 'Reference mode requires at least 1 reference image.' },
                { status: 400 }
            );
        }

        // Upload base64 images to Supabase → get public URLs for KIE API
        let resolvedImageUrls: string[] | undefined;
        if (imageUrls && imageUrls.length > 0) {
            const { getStorageService, STORAGE_BUCKETS } = await import('@/services/storage');
            const storage = getStorageService();
            resolvedImageUrls = [];

            for (let i = 0; i < imageUrls.length; i++) {
                const imgData = imageUrls[i];
                // Already a URL — keep as-is
                if (imgData.startsWith('http')) {
                    resolvedImageUrls.push(imgData);
                    continue;
                }
                // Upload base64 to Supabase
                try {
                    const timestamp = Date.now();
                    const random = Math.random().toString(36).substring(7);
                    let contentType = 'image/png';
                    if (imgData.startsWith('data:')) {
                        const match = imgData.match(/^data:(image\/[a-z]+);base64,/);
                        if (match) contentType = match[1];
                    }
                    const ext = contentType.split('/')[1] || 'png';
                    const filename = `video-inputs/${timestamp}-${random}-${i}.${ext}`;

                    const { publicUrl } = await storage.uploadBase64(
                        STORAGE_BUCKETS.CUSTOM_REFERENCES.name,
                        imgData,
                        { contentType, filename }
                    );
                    console.log(`✅ [Video] Uploaded input image ${i}: ${publicUrl}`);
                    resolvedImageUrls.push(publicUrl);
                } catch (e) {
                    console.error(`[Video] Failed to upload image ${i}:`, e);
                    return NextResponse.json(
                        { error: `Failed to upload image ${i + 1}. Please try again.` },
                        { status: 500 }
                    );
                }
            }
        }

        const { taskId } = await KieService.createVeoTask({
            prompt,
            model: veoModel,
            aspectRatio: veoAspect,
            generationType: generationMode,
            imageUrls: resolvedImageUrls && resolvedImageUrls.length > 0 ? resolvedImageUrls : undefined,
            seeds,
        }, apiKey);

        console.log(`✅ [Video] Veo task created: ${taskId} (model: ${veoModel})`);

        // --- ASYNC FLOW: Insert pending record, return taskId for client polling ---
        const { db } = await import('@/lib/db');
        const { generations } = await import('@/lib/db/schema');

        let estimatedCost = 0.006; // Default for video
        if (modelDef?.costPerGeneration) {
            estimatedCost = modelDef.costPerGeneration * 0.0001;
        }

        const [pendingRecord] = await db.insert(generations).values({
            userId,
            promptTitle: executionConfig?.promptTitle || prompt.substring(0, 50) + '...',
            model: modelId,
            output: '__pending__',
            type: 'video',
            settings: {
                ...videoSettings,
                _kieTaskId: taskId,
                _kieProvider: 'kie',
                _veoModel: veoModel,
            },
            promptContent: prompt,
            inputData: {
                videoSettings: {
                    generationMode,
                    aspectRatio: veoAspect,
                    imageUrls: resolvedImageUrls,
                    seeds,
                },
                ...(body.brandContext ? { brandContext: { id: body.brandContext.id, name: body.brandContext.name } } : {}),
            },
            cost: estimatedCost.toString(),
            latency: null,
            promptId: executionConfig?.promptId,
            brandId: body.brandContext?.id,
            domain: executionConfig?.domain || null,
        }).returning();

        return NextResponse.json({
            async: true,
            taskId,
            generationId: pendingRecord.id,
            status: 'processing',
            type: 'video',
        });

    } catch (error) {
        console.error('Video Generation Error:', error);
        await refundGenerationCredits(userId, modelId).catch(e =>
            console.error('Credit refund failed:', e)
        );
        return internalError(error, 'Video Generation');
    }
}
