import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { refundGenerationCredits } from '@/lib/api/creditGate';
import { enforceRateLimit, enforceCredits, getKieApiKey } from '@/lib/api/routeGuards';
import { internalError } from '@/lib/api/errorResponse';

/**
 * Audio/Music Generation Route
 * Uses KIE's Suno endpoint (/api/v1/generate) with async polling flow
 * Status polling: /api/v1/generate/record-info
 */

// Map our model IDs to Suno API model params
const SUNO_MODEL_MAP: Record<string, string> = {
    'suno-v4': 'V4',
    'suno-v4.5': 'V4_5',
    'suno-v5': 'V5',
};

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
        modelId = 'suno-v4.5',
        audioSettings,
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

        // --- KIE Suno ---
        const { KieService } = await import('@/services/kieService');
        const apiKey = getKieApiKey();
        if (!apiKey) {
            return NextResponse.json(
                { error: 'KIE_API_KEY is not configured. Please add it to your .env.local file.' },
                { status: 500 }
            );
        }

        // Map modelId to Suno model param
        const sunoModel = SUNO_MODEL_MAP[modelId] || 'V4_5';

        // Extract audio settings
        const customMode = audioSettings?.customMode ?? false;
        const instrumental = audioSettings?.instrumental ?? false;
        const style = audioSettings?.style;
        const title = audioSettings?.title;
        const negativeTags = audioSettings?.negativeTags;
        const vocalGender = audioSettings?.vocalGender;
        const styleWeight = audioSettings?.styleWeight;
        const weirdnessConstraint = audioSettings?.weirdnessConstraint;
        const audioWeight = audioSettings?.audioWeight;

        const { taskId } = await KieService.createSunoTask({
            prompt,
            customMode,
            instrumental,
            model: sunoModel as 'V3_5' | 'V4' | 'V4_5' | 'V4_5PLUS' | 'V4_5ALL' | 'V5',
            style: customMode ? style : undefined,
            title: customMode ? title : undefined,
            negativeTags,
            vocalGender: !instrumental ? vocalGender : undefined,
            styleWeight,
            weirdnessConstraint,
            audioWeight,
        }, apiKey);

        console.log(`✅ [Audio] Suno task created: ${taskId} (model: ${sunoModel}, custom: ${customMode}, instrumental: ${instrumental})`);

        // --- ASYNC FLOW: Insert pending record, return taskId for client polling ---
        const { db } = await import('@/lib/db');
        const { generations } = await import('@/lib/db/schema');

        let estimatedCost = 0.0015; // Default for audio
        if (modelDef?.costPerGeneration) {
            estimatedCost = modelDef.costPerGeneration * 0.0001;
        }

        const [pendingRecord] = await db.insert(generations).values({
            userId,
            promptTitle: executionConfig?.promptTitle || prompt.substring(0, 50) + '...',
            model: modelId,
            output: '__pending__',
            type: 'audio',
            settings: {
                ...audioSettings,
                _kieTaskId: taskId,
                _kieProvider: 'kie',
                _sunoModel: sunoModel,
            },
            promptContent: prompt,
            inputData: {
                audioSettings: audioSettings || {},
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
            type: 'audio',
        });

    } catch (error) {
        console.error('Audio Generation Error:', error);
        await refundGenerationCredits(userId, modelId).catch(e =>
            console.error('Credit refund failed:', e)
        );
        return internalError(error, 'Audio Generation');
    }
}
