import type { NormalizedRunResult, ProviderRunOptions } from '@/features/external-tools/types';

// ── Website Builder ───────────────────────────────────────────────────────────

export type WebsiteBuilderOperation = 'generate' | 'edit' | 'publish' | 'get-status';

export function toWebsiteBuilderProviderOptions(
  operation: WebsiteBuilderOperation,
  input: Record<string, unknown>,
  userId: string,
  threadId?: string,
): ProviderRunOptions {
  return {
    toolSlug: 'website-builder',
    userId,
    threadId,
    source: 'sidebar',
    input: { operation, ...input },
  };
}

export function fromWebsiteBuilderResult(result: NormalizedRunResult): Record<string, unknown> {
  return (result.data ?? {}) as Record<string, unknown>;
}

// ── Web Deploy ────────────────────────────────────────────────────────────────

/**
 * Operations for the web-deploy tool:
 * - read-file: fetch file content + SHA from the website repo
 * - preview-change: stage a proposed change (copy edit, page clone, blog post)
 * - confirm-change: commit the staged change as a GitHub PR
 *
 * The confirm-change operation passes the vajaRunId from the preview step so the
 * provider can look up the staged change it stored when it processed preview-change.
 */
export type WebDeployOperation = 'read-file' | 'preview-change' | 'confirm-change';

export function toWebDeployProviderOptions(
  operation: WebDeployOperation,
  input: Record<string, unknown>,
  userId: string,
  threadId?: string,
): ProviderRunOptions {
  return {
    toolSlug: 'web-deploy',
    userId,
    threadId,
    source: 'sidebar',
    input: { operation, ...input },
  };
}

export function fromWebDeployResult(result: NormalizedRunResult): Record<string, unknown> {
  return (result.data ?? {}) as Record<string, unknown>;
}
