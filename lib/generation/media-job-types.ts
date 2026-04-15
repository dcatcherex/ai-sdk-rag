/**
 * Shared media job contract.
 *
 * All product-facing media generation (image, video, audio, speech) uses
 * toolRun as the job ledger. This file defines:
 *
 *  - The canonical output shape written to toolRun.outputJson
 *  - A helper to extract normalized URL arrays from that JSON
 *
 * See docs/kie-media-generation-implementation.md for architecture context.
 */

export type MediaJobKind = 'image' | 'video' | 'audio' | 'speech';
export type MediaJobStatus = 'pending' | 'success' | 'failed' | 'timeout';

/**
 * Normalized output shape for all media jobs.
 * toolRun.outputJson should always be interpretable through this lens.
 *
 * Feature-specific extras (audioMeta, width, height, etc.) live in the raw
 * toolRun.outputJson alongside these fields — callers that need them can read
 * them directly.
 */
export type MediaJobOutput = {
  kind: MediaJobKind;
  status: MediaJobStatus;
  generationId: string;
  taskId?: string;
  outputUrls?: string[];
  thumbnailUrls?: string[];
  mimeTypes?: string[];
  error?: string;
};

/**
 * Maps toolRun.toolSlug to the canonical MediaJobKind.
 * Returns undefined for non-media slugs.
 */
export function toolSlugToMediaKind(toolSlug: string): MediaJobKind | undefined {
  switch (toolSlug) {
    case 'image': return 'image';
    case 'video': return 'video';
    case 'audio': return 'audio';
    case 'speech': return 'speech';
    default: return undefined;
  }
}

/**
 * Extracts normalized URL arrays from a raw toolRun.outputJson.
 *
 * Both the callback route and the status route write output to the DB with
 * these field names:
 *   - Single: { output: string }
 *   - Multi:  { outputs: string[] }
 *   - Thumbs: { thumbnailUrl: string } or { thumbnailUrls: string[] }
 *
 * This function consolidates those into clean arrays so callers don't need
 * to handle every variant.
 */
export function extractMediaOutputUrls(
  outputJson: Record<string, unknown> | null,
): { outputUrls: string[]; thumbnailUrls: string[] } {
  if (!outputJson) return { outputUrls: [], thumbnailUrls: [] };

  const outputUrls: string[] = [];
  if (Array.isArray(outputJson.outputs)) {
    for (const u of outputJson.outputs) {
      if (typeof u === 'string' && u.length > 0) outputUrls.push(u);
    }
  } else if (typeof outputJson.output === 'string' && outputJson.output.length > 0) {
    outputUrls.push(outputJson.output);
  }

  const thumbnailUrls: string[] = [];
  if (Array.isArray(outputJson.thumbnailUrls)) {
    for (const u of outputJson.thumbnailUrls) {
      if (typeof u === 'string' && u.length > 0) thumbnailUrls.push(u);
    }
  } else if (typeof outputJson.thumbnailUrl === 'string' && outputJson.thumbnailUrl.length > 0) {
    thumbnailUrls.push(outputJson.thumbnailUrl);
  }

  return { outputUrls, thumbnailUrls };
}
