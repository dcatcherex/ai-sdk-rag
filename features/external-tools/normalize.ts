import type { NormalizedRunResult, ProviderArtifact, ProviderResponseEnvelope } from './types';
import type { ToolExecutionResult } from '@/features/tools/registry/types';
import { mapProviderArtifacts } from './artifacts';

export function normalizeRunResult(
  vajaRunId: string,
  response: ProviderResponseEnvelope,
): NormalizedRunResult {
  return {
    vajaRunId,
    providerRunId: response.providerRunId,
    status: response.status,
    title: response.title ?? (response.data?.title as string) ?? 'Tool result',
    summary: response.summary,
    data: response.data,
    artifacts: response.artifacts,
    usage: response.usage,
    error: response.error,
    completedAt: response.completedAt,
  };
}

export function toToolExecutionResult<TData = unknown>(
  toolName: string,
  result: NormalizedRunResult,
): ToolExecutionResult<TData> {
  return {
    tool: toolName,
    runId: result.vajaRunId,
    title: result.title,
    summary: result.summary,
    data: (result.data ?? {}) as TData,
    artifacts: mapProviderArtifacts(result.artifacts),
    createdAt: result.completedAt ?? new Date().toISOString(),
  };
}
