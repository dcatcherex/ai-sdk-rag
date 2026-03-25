import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { toolRun, mediaAsset } from '@/db/schema';
import { validateUrl } from '@/lib/security/ssrfProtection';

const TOOL_SLUG_TO_MEDIA_TYPE: Record<string, string> = {
  image: 'image',
  video: 'video',
  audio: 'audio',
  speech: 'audio',
};

/**
 * POST /api/generate/persist
 *
 * Persists completed generation output from temporary KIE URLs to permanent R2 storage.
 *
 * Actions:
 *   - serverPersist:  Server-side download from KIE URL + upload to R2 (primary path)
 *   - updateUrl:      Updates DB record with a permanent URL after client-side upload
 */
export async function POST(req: NextRequest) {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { generationId, action, publicUrl } = body;

    if (!generationId || !action) {
        return NextResponse.json({ error: 'Missing generationId or action' }, { status: 400 });
    }

    const [record] = await db.select().from(toolRun)
        .where(eq(toolRun.id, generationId)).limit(1);

    if (!record) {
        return NextResponse.json({ error: 'Generation not found' }, { status: 404 });
    }

    if (record.userId !== session.user.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const outputJson = (record.outputJson ?? {}) as Record<string, unknown>;
    const currentOutput = outputJson.output as string | undefined;
    const r2BaseUrl = process.env.R2_PUBLIC_BASE_URL ?? '';

    // Already persisted to R2?
    if (currentOutput && r2BaseUrl && currentOutput.startsWith(r2BaseUrl)) {
        return NextResponse.json({ alreadyPersisted: true, publicUrl: currentOutput });
    }

    // ── Action: serverPersist ──────────────────────────────────────────────────
    if (action === 'serverPersist' || action === 'getSignedUrl') {
        // Note: 'getSignedUrl' falls back here — R2 presigned uploads not implemented yet.
        // Client-side persist path is not available; server handles the download+upload.
        const sourceUrl = currentOutput;
        if (!sourceUrl) {
            return NextResponse.json({ error: 'No source URL to persist' }, { status: 400 });
        }
        if (r2BaseUrl && sourceUrl.startsWith(r2BaseUrl)) {
            return NextResponse.json({ alreadyPersisted: true, publicUrl: sourceUrl });
        }

        const urlValidation = validateUrl(sourceUrl);
        if (!urlValidation.valid) {
            return NextResponse.json({ error: `Invalid source URL: ${urlValidation.error}` }, { status: 400 });
        }

        try {
            const { getStorageService, STORAGE_BUCKETS } = await import('@/lib/storage/index');
            const storage = getStorageService();
            const type = record.toolSlug;

            let bucket: string;
            if (type === 'video') {
                bucket = STORAGE_BUCKETS.GENERATED_VIDEOS.name;
            } else if (type === 'audio' || type === 'speech') {
                bucket = STORAGE_BUCKETS.GENERATED_AUDIO.name;
            } else {
                bucket = STORAGE_BUCKETS.GENERATED_IMAGES.name;
            }

            const { publicUrl: finalUrl, r2Key, mimeType, sizeBytes } = await storage.uploadFromUrl(bucket, sourceUrl);

            await db.update(toolRun)
                .set({ outputJson: { ...outputJson, output: finalUrl } })
                .where(eq(toolRun.id, generationId));

            // Insert into mediaAsset so it appears in the gallery
            const mediaType = TOOL_SLUG_TO_MEDIA_TYPE[type] ?? 'image';
            await db.insert(mediaAsset).values({
                id: nanoid(),
                userId: record.userId,
                type: mediaType,
                r2Key,
                url: finalUrl,
                mimeType,
                sizeBytes,
            }).onConflictDoNothing();

            console.log(`✅ [persist] R2 upload done for ${generationId}: ${finalUrl}`);
            return NextResponse.json({ success: true, publicUrl: finalUrl });

        } catch (err) {
            console.error('[persist] Server-side persist error:', err);
            return NextResponse.json({ error: 'Server persist failed' }, { status: 500 });
        }
    }

    // ── Action: updateUrl ──────────────────────────────────────────────────────
    if (action === 'updateUrl') {
        if (!publicUrl) {
            return NextResponse.json({ error: 'Missing publicUrl' }, { status: 400 });
        }

        const urlValidation = validateUrl(publicUrl, { requireTrustedDomain: true });
        if (!urlValidation.valid) {
            return NextResponse.json({ error: `Invalid URL: ${urlValidation.error}` }, { status: 400 });
        }

        await db.update(toolRun)
            .set({ outputJson: { ...outputJson, output: publicUrl } })
            .where(eq(toolRun.id, generationId));

        return NextResponse.json({ success: true, publicUrl });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
