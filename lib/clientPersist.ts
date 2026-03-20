/**
 * Client-Side Generation Persistence
 * 
 * Persists generated files (images/videos/audio) from temporary KIE URLs
 * to permanent Supabase Storage — WITHOUT routing file data through Vercel.
 * 
 * Flow:
 *   1. Get signed upload URL from server (tiny JSON request, ~500 bytes)
 *   2. Download file from KIE URL in the browser (browser → KIE, bypasses Vercel)
 *   3. Upload to Supabase via signed URL (browser → Supabase, bypasses Vercel)
 *   4. Update DB with permanent URL via server (tiny JSON request, ~200 bytes)
 * 
 * If CORS blocks the browser download (step 2), falls back to server-side
 * persist which DOES use Vercel Fast Origin Transfer.
 */

interface PersistResult {
    success: boolean;
    publicUrl?: string;
    method?: 'client' | 'server' | 'skipped';
}

export async function persistGeneration(
    generationId: string,
    sourceUrl: string,
): Promise<PersistResult> {
    // Skip if already persisted to R2
    const r2BaseUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL;
    if (r2BaseUrl && sourceUrl.startsWith(r2BaseUrl)) {
        return { success: true, publicUrl: sourceUrl, method: 'skipped' };
    }

    try {
        // Step 1: Get signed upload URL from server (tiny request)
        const signRes = await fetch('/api/generate/persist', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ generationId, action: 'getSignedUrl' }),
        });

        const signData = await signRes.json();

        if (signData.alreadyPersisted) {
            return { success: true, publicUrl: signData.publicUrl, method: 'skipped' };
        }

        if (!signRes.ok) {
            throw new Error(signData.error || 'Failed to get signed URL');
        }

        // Step 2: Try to download file in the browser (bypasses Vercel)
        const sourceDomain = new URL(sourceUrl).hostname;
        let blob: Blob;
        try {
            const fileRes = await fetch(sourceUrl);
            if (!fileRes.ok) throw new Error(`Download failed: ${fileRes.status}`);
            blob = await fileRes.blob();
            const sizeMB = (blob.size / (1024 * 1024)).toFixed(2);
            console.log(`[persist] ✅ CORS OK for ${sourceDomain} — downloaded ${sizeMB} MB client-side`);
        } catch (corsErr) {
            // CORS blocked or network error → fall back to server-side persist
            console.warn(`[persist] ❌ CORS blocked for ${sourceDomain} — falling back to server-side`, corsErr);
            return await serverPersistFallback(generationId);
        }

        // Step 3: Upload to Supabase via signed URL (bypasses Vercel)
        try {
            const uploadRes = await fetch(signData.signedUrl, {
                method: 'PUT',
                body: blob,
                headers: {
                    'Content-Type': blob.type || 'application/octet-stream',
                },
            });

            if (!uploadRes.ok) {
                throw new Error(`Supabase upload failed: ${uploadRes.status}`);
            }
        } catch {
            console.warn('[persist] Signed URL upload failed, using server fallback');
            return await serverPersistFallback(generationId);
        }

        // Step 4: Construct public URL and update DB (tiny request)
        const publicUrl = `${signData.supabaseUrl}/storage/v1/object/public/${signData.bucket}/${signData.filename}`;

        await fetch('/api/generate/persist', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                generationId,
                action: 'updateUrl',
                publicUrl,
            }),
        });

        console.log(`✅ [persist] Client-side persist succeeded for ${generationId}`);
        return { success: true, publicUrl, method: 'client' };
    } catch (err) {
        console.error('[persist] Unexpected error:', err);
        // Last resort: try server-side
        return await serverPersistFallback(generationId);
    }
}

async function serverPersistFallback(generationId: string): Promise<PersistResult> {
    try {
        const res = await fetch('/api/generate/persist', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ generationId, action: 'serverPersist' }),
        });

        const data = await res.json();

        if (data.alreadyPersisted || data.success) {
            console.log(`✅ [persist] Server fallback succeeded for ${generationId}`);
            return { success: true, publicUrl: data.publicUrl, method: 'server' };
        }

        return { success: false };
    } catch (err) {
        console.error('[persist] Server fallback also failed:', err);
        return { success: false };
    }
}
