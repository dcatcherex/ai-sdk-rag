import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { toolRun } from '@/db/schema';
import { getKieApiKey } from '@/lib/api/routeGuards';
import { persistToolRunOutputToStorage, persistToolRunOutputsToStorage } from '@/lib/generation/persist-tool-run-output';
import { resolveKieTaskStatus } from '../_shared/kieStatus';
import type { GenerationType } from '../_shared/kieStatus';

/**
 * GET /api/generate/status?taskId=xxx&generationId=yyy
 *
 * Polls KIE task status, updates the toolRun record on completion,
 * and returns the result to the client polling service.
 *
 * Returns:
 *  - { status: 'processing' }
 *  - { status: 'success', output, generationId, latency, type, audioMeta? }
 *  - { status: 'failed', error }
 */
export async function GET(req: NextRequest) {
    const session = await auth.api.getSession({ headers: req.headers });
    const { searchParams } = new URL(req.url);
    const taskId = searchParams.get('taskId');
    const generationId = searchParams.get('generationId');

    if (!taskId || !generationId) {
        return NextResponse.json({ error: 'Missing taskId or generationId' }, { status: 400 });
    }

    const [record] = await db.select().from(toolRun).where(eq(toolRun.id, generationId)).limit(1);

    if (!record) {
        return NextResponse.json({ error: 'Generation not found' }, { status: 404 });
    }

    // Authorization: if session exists, verify ownership
    if (session?.user && record.userId !== session.user.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const generationType = record.toolSlug as GenerationType;
    const outputJson = (record.outputJson ?? {}) as Record<string, unknown>;

    // Already completed — return cached result
    if (record.status === 'success' && outputJson.output) {
        return NextResponse.json({
            status: 'success',
            output: outputJson.output,
            outputUrls: Array.isArray(outputJson.outputs) ? outputJson.outputs : [outputJson.output],
            generationId: record.id,
            latency: outputJson.latency,
            type: generationType,
            ...(generationType === 'audio' && outputJson.audioMeta
                ? { audioMeta: outputJson.audioMeta }
                : {}),
        });
    }

    const apiKey = getKieApiKey();
    if (!apiKey) {
        return NextResponse.json({ error: 'KIE_API_KEY not configured' }, { status: 500 });
    }

    try {
        const result = await resolveKieTaskStatus(taskId, generationType, apiKey);

        if (result.status === 'processing') {
            return NextResponse.json({ status: 'processing' });
        }

        if (result.status === 'failed') {
            await db.update(toolRun)
                .set({ status: 'error', errorMessage: result.error })
                .where(eq(toolRun.id, generationId));
            return NextResponse.json({ status: 'failed', error: result.error });
        }

        // Completed — persist result into toolRun.outputJson
        const { outputUrl, outputUrls, audioMeta } = result;
        const latency = Math.round(Date.now() - new Date(record.createdAt).getTime());
        const resolvedOutputUrls = outputUrls?.length ? outputUrls : [outputUrl];

        await db.update(toolRun)
            .set({
                status: 'success',
                completedAt: new Date(),
                outputJson: {
                    ...outputJson,
                    output: outputUrl,
                    outputs: resolvedOutputUrls,
                    latency,
                    ...(audioMeta ? { audioMeta } : {}),
                },
            })
            .where(eq(toolRun.id, generationId));

        let finalOutputUrl = outputUrl;
        let finalOutputUrls = resolvedOutputUrls;

        if (generationType === 'image' && !outputUrl.startsWith(process.env.R2_PUBLIC_BASE_URL ?? '__never__')) {
            try {
                if (resolvedOutputUrls.length > 1) {
                    const persisted = await persistToolRunOutputsToStorage({
                        generationId: record.id,
                        toolSlug: record.toolSlug,
                        userId: record.userId,
                        outputJson: {
                            ...outputJson,
                            output: outputUrl,
                            outputs: resolvedOutputUrls,
                            latency,
                            ...(audioMeta ? { audioMeta } : {}),
                        },
                        sourceUrls: resolvedOutputUrls,
                    });
                    finalOutputUrls = persisted.publicUrls;
                    finalOutputUrl = persisted.publicUrls[0] ?? outputUrl;
                } else {
                    const persisted = await persistToolRunOutputToStorage({
                        generationId: record.id,
                        toolSlug: record.toolSlug,
                        userId: record.userId,
                        outputJson: {
                            ...outputJson,
                            output: outputUrl,
                            outputs: resolvedOutputUrls,
                            latency,
                            ...(audioMeta ? { audioMeta } : {}),
                        },
                        sourceUrl: outputUrl,
                    });
                    finalOutputUrl = persisted.publicUrl;
                    finalOutputUrls = [persisted.publicUrl];
                }
            } catch (persistError) {
                console.error('[status] Image persist failed:', persistError);
            }
        }

        const needsPersist =
            generationType !== 'image' &&
            !finalOutputUrl.startsWith(process.env.R2_PUBLIC_BASE_URL ?? '__never__');

        const responsePayload: Record<string, unknown> = {
            status: 'success',
            output: finalOutputUrl,
            outputUrls: finalOutputUrls,
            generationId: record.id,
            latency,
            type: generationType,
            needsPersist,
        };

        if (generationType === 'audio' && audioMeta) {
            responsePayload.audioMeta = audioMeta;
        }

        return NextResponse.json(responsePayload);

    } catch (pollError) {
        console.error('[status] Poll error:', pollError);
        return NextResponse.json({
            status: 'failed',
            error: `Status check failed: ${pollError instanceof Error ? pollError.message : 'Unknown error'}`,
        });
    }
}
