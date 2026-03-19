import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { refundGenerationCredits } from '@/lib/api/creditGate';
import { enforceRateLimit, enforceCredits, getKieApiKey } from '@/lib/api/routeGuards';
import { internalError } from '@/lib/api/errorResponse';

/**
 * Speech Generation Route (ElevenLabs TTS & Dialogue)
 * Uses KIE's standard /jobs/createTask endpoint
 * Status polling: /jobs/recordInfo (same as image tasks)
 *
 * Models:
 * - elevenlabs/text-to-speech-multilingual-v2 (single voice TTS)
 * - elevenlabs/text-to-dialogue-v3 (multi-speaker dialogue)
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
        modelId = 'elevenlabs/text-to-speech-multilingual-v2',
        ttsSettings,
        executionConfig,
    } = body;

    try {

        const isDialogue = modelId === 'elevenlabs/text-to-dialogue-v3';

        // Validate: dialogue model needs dialogueLines, TTS model needs prompt text
        if (isDialogue) {
            const lines = ttsSettings?.dialogueLines;
            if (!lines || !Array.isArray(lines) || lines.length === 0) {
                return NextResponse.json(
                    { error: 'Dialogue model requires at least one dialogue line' },
                    { status: 400 }
                );
            }
            // Validate total text length
            const totalLength = lines.reduce((sum: number, l: { text: string }) => sum + (l.text?.length || 0), 0);
            if (totalLength > 5000) {
                return NextResponse.json(
                    { error: `Total dialogue text too long: ${totalLength} characters (max 5000)` },
                    { status: 400 }
                );
            }
        } else {
            if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
                return NextResponse.json({ error: 'Text content is required' }, { status: 400 });
            }
        }

        const { AVAILABLE_MODELS } = await import('@/services/aiService');
        const modelDef = AVAILABLE_MODELS.find(m => m.id === modelId);

        if (!isDialogue && modelDef?.maxPromptLength && prompt.length > modelDef.maxPromptLength) {
            return NextResponse.json(
                {
                    error: `Text too long: ${prompt.length} characters exceeds ${modelDef.maxPromptLength} character limit for ${modelDef.name}.`,
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

        // --- KIE ElevenLabs ---
        const { KieService } = await import('@/services/kieService');
        const apiKey = getKieApiKey();
        if (!apiKey) {
            return NextResponse.json(
                { error: 'KIE_API_KEY is not configured. Please add it to your .env.local file.' },
                { status: 500 }
            );
        }

        let taskId: string;

        if (isDialogue) {
            // Multi-speaker dialogue
            const result = await KieService.createDialogueTask({
                dialogue: ttsSettings.dialogueLines.map((line: { text: string; voice: string }) => ({
                    text: line.text,
                    voice: line.voice,
                })),
                stability: ttsSettings?.stability,
                languageCode: ttsSettings?.languageCode,
            }, apiKey);
            taskId = result.taskId;

            console.log(`✅ [Speech] Dialogue task created: ${taskId} (lines: ${ttsSettings.dialogueLines.length})`);
        } else {
            // Single-voice TTS (multilingual-v2 does NOT support language_code)
            const result = await KieService.createTtsTask({
                text: prompt,
                voice: ttsSettings?.voice,
                stability: ttsSettings?.stability,
                similarityBoost: ttsSettings?.similarityBoost,
                style: ttsSettings?.style,
                speed: ttsSettings?.speed,
            }, apiKey);
            taskId = result.taskId;

            console.log(`✅ [Speech] TTS task created: ${taskId} (voice: ${ttsSettings?.voice || 'default'})`);
        }

        // --- ASYNC FLOW: Insert pending record, return taskId for client polling ---
        const { db } = await import('@/lib/db');
        const { generations } = await import('@/lib/db/schema');

        let estimatedCost = 0.0005; // Default for speech
        if (modelDef?.costPerGeneration) {
            estimatedCost = modelDef.costPerGeneration * 0.0001;
        }

        const [pendingRecord] = await db.insert(generations).values({
            userId,
            promptTitle: executionConfig?.promptTitle || (isDialogue ? 'Dialogue' : prompt.substring(0, 50) + '...'),
            model: modelId,
            output: '__pending__',
            type: 'speech',
            settings: {
                ...ttsSettings,
                _kieTaskId: taskId,
                _kieProvider: 'kie',
            },
            promptContent: isDialogue ? JSON.stringify(ttsSettings?.dialogueLines) : prompt,
            inputData: {
                ttsSettings: ttsSettings || {},
                isDialogue,
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
            type: 'speech',
        });

    } catch (error) {
        console.error('Speech Generation Error:', error);
        await refundGenerationCredits(userId, modelId).catch(e =>
            console.error('Credit refund failed:', e)
        );
        return internalError(error, 'Speech Generation');
    }
}
