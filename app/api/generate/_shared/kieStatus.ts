/**
 * Shared KIE task status resolver.
 *
 * Centralizes the Suno / Veo / KIE-Jobs state-machine logic that was
 * previously duplicated between status/route.ts and recover/route.ts.
 */

export type GenerationType = 'image' | 'video' | 'text' | 'audio' | 'speech';

export interface AudioMeta {
    audioUrl: string;
    imageUrl: string | undefined;
    title: string;
    tags: string;
    duration: number;
    tracks: Array<{
        id: string;
        audioUrl: string;
        imageUrl: string | undefined;
        title: string;
        tags: string;
        duration: number;
        prompt: string;
    }>;
}

export type KieTaskResult =
    | { status: 'processing' }
    | { status: 'completed'; outputUrl: string; outputUrls?: string[]; audioMeta?: AudioMeta }
    | { status: 'failed'; error: string };

export interface KieJobsStatusPayload {
    code?: number;
    msg?: string;
    data?: Record<string, any> | null;
}

function collectImageUrls(taskInfo: Record<string, any>): string[] {
    const collected: string[] = [];
    const pushUrl = (value: unknown) => {
        if (typeof value === 'string' && value.trim().length > 0) {
            collected.push(value);
        }
    };

    if (taskInfo.resultJson) {
        try {
            const parsed = JSON.parse(taskInfo.resultJson);
            if (Array.isArray(parsed.resultUrls)) {
                parsed.resultUrls.forEach(pushUrl);
            }
            if (Array.isArray(parsed.images)) {
                parsed.images.forEach((image: unknown) => {
                    if (typeof image === 'string') {
                        pushUrl(image);
                        return;
                    }
                    if (image && typeof image === 'object') {
                        pushUrl((image as { url?: unknown }).url);
                    }
                });
            }
        } catch { /* ignore */ }
    }

    if (Array.isArray(taskInfo.resultUrls)) {
        taskInfo.resultUrls.forEach(pushUrl);
    }

    if (Array.isArray(taskInfo.results)) {
        taskInfo.results.forEach((item: unknown) => {
            if (item && typeof item === 'object') {
                pushUrl((item as { url?: unknown }).url);
            }
        });
    }

    if (Array.isArray(taskInfo.images)) {
        taskInfo.images.forEach((item: unknown) => {
            if (typeof item === 'string') {
                pushUrl(item);
                return;
            }
            if (item && typeof item === 'object') {
                pushUrl((item as { url?: unknown }).url);
            }
        });
    }

    return Array.from(new Set(collected));
}

export function resolveKieJobsStatusPayload(statusData: KieJobsStatusPayload): KieTaskResult {
    if (statusData.code !== 200) {
        const msg = (statusData.msg || '').toLowerCase();
        if (msg.includes('recordinfo') && msg.includes('null')) {
            return { status: 'processing' };
        }
        return { status: 'failed', error: `Task check failed: ${statusData.msg}` };
    }

    const taskInfo = statusData.data;
    if (!taskInfo) return { status: 'processing' };

    const state = taskInfo.state || taskInfo.status;
    const SUCCESS_STATES = new Set(['success', 'SUCCEEDED', 'SUCCESS', 1]);
    const FAILED_STATES = new Set(['fail', 'FAILED', 'FAILURE', 2]);

    if (!SUCCESS_STATES.has(state) && !FAILED_STATES.has(state)) {
        return { status: 'processing' };
    }

    if (FAILED_STATES.has(state)) {
        const error = taskInfo.failMsg || taskInfo.failureReason || 'Unknown reason';
        return { status: 'failed', error: `Generation failed: ${error}` };
    }

    const outputUrls = collectImageUrls(taskInfo);
    if (outputUrls.length > 0) {
        return { status: 'completed', outputUrl: outputUrls[0]!, outputUrls };
    }
    return { status: 'failed', error: 'No output URL in result' };
}

/**
 * Polls a KIE task and returns a typed result. Does NOT write to the database.
 * Callers are responsible for updating DB records based on the result.
 */
export async function resolveKieTaskStatus(
    taskId: string,
    generationType: GenerationType,
    apiKey: string,
): Promise<KieTaskResult> {
    const { KieService } = await import('@/lib/providers/kieService');

    // ── Audio: Suno tasks via /generate/record-info ──────────────────────────
    if (generationType === 'audio') {
        const statusData = await KieService.getSunoTaskStatus(taskId, apiKey);

        if (statusData.code !== 200) {
            const msg = (statusData.msg || '').toLowerCase();
            if (msg.includes('null') || msg.includes('not found') || msg.includes('processing')) {
                return { status: 'processing' };
            }
            return { status: 'failed', error: `Task check failed: ${statusData.msg}` };
        }

        const sunoData = statusData.data;
        if (!sunoData) return { status: 'processing' };

        const sunoStatus = sunoData.status;

        if (sunoStatus === 'PENDING' || sunoStatus === 'TEXT_SUCCESS') {
            return { status: 'processing' };
        }

        const SUNO_FAILED = ['CREATE_TASK_FAILED', 'GENERATE_AUDIO_FAILED', 'CALLBACK_EXCEPTION', 'SENSITIVE_WORD_ERROR'];
        if (SUNO_FAILED.includes(sunoStatus)) {
            const error = sunoData.errorMessage || `Audio generation failed: ${sunoStatus}`;
            return { status: 'failed', error };
        }

        if (sunoStatus === 'SUCCESS' || sunoStatus === 'FIRST_SUCCESS') {
            const tracks = sunoData.response?.sunoData;
            if (tracks && tracks.length > 0) {
                const firstTrack = tracks[0];
                const audioMeta: AudioMeta = {
                    audioUrl: firstTrack.audioUrl,
                    imageUrl: firstTrack.imageUrl,
                    title: firstTrack.title,
                    tags: firstTrack.tags,
                    duration: firstTrack.duration,
                    tracks: tracks.map((t: typeof firstTrack) => ({
                        id: t.id,
                        audioUrl: t.audioUrl,
                        imageUrl: t.imageUrl,
                        title: t.title,
                        tags: t.tags,
                        duration: t.duration,
                        prompt: t.prompt,
                    })),
                };
                return { status: 'completed', outputUrl: firstTrack.audioUrl, audioMeta };
            }
        }

        return { status: 'processing' };
    }

    // ── Video: Veo tasks via /veo/record-info ─────────────────────────────────
    if (generationType === 'video') {
        const statusData = await KieService.getVeoTaskStatus(taskId, apiKey);

        if (statusData.code !== 200) {
            const msg = (statusData.msg || '').toLowerCase();
            if (msg.includes('null') || msg.includes('not found') || msg.includes('processing')) {
                return { status: 'processing' };
            }
            return { status: 'failed', error: `Task check failed: ${statusData.msg}` };
        }

        const veoData = statusData.data;
        if (!veoData) return { status: 'processing' };

        // successFlag: 0=processing, 1=success, 2=failed, 3=generation failed
        if (veoData.successFlag === 0) return { status: 'processing' };

        if (veoData.successFlag === 2 || veoData.successFlag === 3) {
            const error = statusData.msg || 'Video generation failed';
            return { status: 'failed', error: `Generation failed: ${error}` };
        }

        if (veoData.successFlag === 1) {
            let outputUrl = '';
            const veoResponse = (veoData as Record<string, unknown>).response as Record<string, unknown> | undefined;
            if (veoResponse?.resultUrls) {
                const urls = veoResponse.resultUrls;
                if (Array.isArray(urls) && urls.length > 0) {
                    outputUrl = urls[0] as string;
                }
            }
            // Fallback: try resultUrls directly on data (handles API shape changes)
            if (!outputUrl && veoData.resultUrls) {
                if (typeof veoData.resultUrls === 'string') {
                    try {
                        const urls = JSON.parse(veoData.resultUrls);
                        if (Array.isArray(urls) && urls.length > 0) outputUrl = urls[0];
                    } catch { /* ignore */ }
                }
            }
            if (outputUrl) return { status: 'completed', outputUrl };
        }

        return { status: 'processing' };
    }

    // ── Image / Text: KIE jobs via /jobs/recordInfo ───────────────────────────
    const statusData = await KieService.getTaskStatus(taskId, apiKey);
    return resolveKieJobsStatusPayload(statusData);
}
