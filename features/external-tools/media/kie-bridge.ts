/**
 * KIE ↔ Vaja provider envelope bridge.
 *
 * Converts the KIE media job output stored in toolRun.outputJson into the
 * canonical ProviderResponseEnvelope and MediaJobStatus shapes so that the
 * Phase 3 status endpoint and chat hydration layer speak the same language
 * for both local-provider and KIE-backed jobs.
 *
 * All functions are pure — no DB imports, fully testable.
 */

import { extractMediaOutputUrls, toolSlugToMediaKind } from '@/lib/generation/media-job-types';
import type { ProviderResponseEnvelope } from '@/features/external-tools/types';
import type { KieOutputJson, MediaJobStatus } from './types';

// ── Format resolution ──────────────────────────────────────────────────────────

function guessFormat(url: string, slug: string): string {
  const clean = url.split('?')[0];
  const ext = clean.split('.').pop()?.toLowerCase();
  if (ext && ext.length <= 4) return ext;
  // Fall back to slug-based mime guess
  if (slug === 'video') return 'mp4';
  if (slug === 'audio') return 'mp3';
  if (slug === 'speech') return 'mp3';
  return 'jpg';
}

// ── KIE output → ProviderResponseEnvelope ─────────────────────────────────────

/**
 * Convert a KIE media toolRun's current state into a ProviderResponseEnvelope.
 * This allows Phase 3 status/polling infrastructure to present media jobs
 * in the same shape as certificate or other external provider jobs.
 */
export function kieRunToProviderEnvelope(params: {
  toolRunId: string;
  toolSlug: string;
  /** toolRun.status as written by complete/failMediaRun */
  runStatus: string;
  outputJson: KieOutputJson | null;
  createdAt: Date;
  completedAt: Date | null;
}): ProviderResponseEnvelope {
  const { toolRunId, toolSlug, runStatus, outputJson, createdAt, completedAt } = params;
  const out = outputJson ?? {};
  const { outputUrls, thumbnailUrls } = extractMediaOutputUrls(out as Record<string, unknown>);

  const providerRunId = out.providerRunId ?? out.kieTaskId ?? toolRunId;

  const status: ProviderResponseEnvelope['status'] =
    runStatus === 'success' ? 'success'
    : runStatus === 'error' || runStatus === 'failed' ? 'failed'
    : 'pending';

  return {
    providerRunId,
    status,
    title: outputUrls.length > 0
      ? `${outputUrls.length} ${toolSlug} output${outputUrls.length !== 1 ? 's' : ''} generated`
      : status === 'pending' ? `${toolSlug} generating…` : undefined,
    summary: thumbnailUrls.length > 0 ? `${thumbnailUrls.length} preview(s) available` : undefined,
    data: {
      toolSlug,
      kieTaskId: out.kieTaskId,
      latency: out.latency,
      outputUrls,
      thumbnailUrls,
    },
    artifacts: outputUrls.map((url, i) => ({
      kind: toolSlug,
      format: guessFormat(url, toolSlug),
      url,
      label: outputUrls.length > 1 ? `Output ${i + 1}` : `${toolSlug} output`,
    })),
    error: status === 'failed'
      ? { code: 'KIE_ERROR', message: out.error ?? 'Generation failed', retryable: false }
      : undefined,
    createdAt: createdAt.toISOString(),
    completedAt: completedAt?.toISOString(),
  };
}

// ── toolRun record → MediaJobStatus ───────────────────────────────────────────

/**
 * Normalize a media toolRun DB row into the canonical MediaJobStatus shape.
 * Used by API routes that return job status to clients.
 */
export function toolRunToMediaJobStatus(run: {
  id: string;
  toolSlug: string;
  status: string;
  outputJson: unknown;
  errorMessage: string | null;
  createdAt: Date;
  completedAt: Date | null;
}): MediaJobStatus {
  const out = (run.outputJson ?? {}) as KieOutputJson;
  const { outputUrls, thumbnailUrls } = extractMediaOutputUrls(out as Record<string, unknown>);
  const kind = toolSlugToMediaKind(run.toolSlug) ?? 'image';

  const status: MediaJobStatus['status'] =
    run.status === 'success' ? 'success'
    : run.status === 'error' || run.status === 'failed' ? 'error'
    : 'pending';

  return {
    generationId: run.id,
    toolSlug: run.toolSlug,
    kind,
    status,
    outputUrls,
    thumbnailUrls,
    providerRunId: out.providerRunId ?? out.kieTaskId,
    latency: out.latency,
    error: run.errorMessage ?? out.error,
    createdAt: run.createdAt.toISOString(),
    completedAt: run.completedAt?.toISOString() ?? null,
  };
}

// ── Context scoping ────────────────────────────────────────────────────────────

/**
 * Returns the minimal brand context to include in a media job request.
 * Prevents sending full brand/workspace data to external providers.
 */
export function scopeBrandContextForProvider(opts: {
  brandId?: string;
  logoUrl?: string;
  primaryColor?: string;
  brandName?: string;
}): Record<string, unknown> {
  const ctx: Record<string, unknown> = {};
  if (opts.brandId) ctx.brandId = opts.brandId;
  if (opts.logoUrl) ctx.logoUrl = opts.logoUrl;
  if (opts.primaryColor) ctx.primaryColor = opts.primaryColor;
  if (opts.brandName) ctx.brandName = opts.brandName;
  return ctx;
}
