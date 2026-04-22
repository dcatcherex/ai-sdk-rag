import type { ToolSet } from 'ai';
import { weatherTools } from './weather';
import { ragTools, createScopedRagTools } from './rag';
import { ALL_TOOL_IDS } from '@/lib/tool-registry';
import { buildRegistryAgentTools } from '@/features/tools/registry/server';
import type { AgentToolContext } from '@/features/tools/registry/types';

export { weatherTools, ragTools, createScopedRagTools };

export type BuildToolSetOptions = {
  /** Which tool IDs to include. Pass null to include all. */
  enabledToolIds: string[] | null;
  /** The user ID — needed for user-scoped tools (certificate). */
  userId: string;
  /** Active brand ID — scopes brand photos to the correct brand. */
  brandId?: string;
  /** When set, RAG tools are scoped to these document IDs only. */
  documentIds?: string[];
  /** Enable Cohere cross-encoder reranking after hybrid retrieval. */
  rerankEnabled?: boolean;
  /** Execution context for tools with side effects. */
  source?: 'manual' | 'agent';
  /** Thread-scoped context for media tools. */
  threadId?: string;
  /** Stable reference image URLs for the current request. */
  referenceImageUrls?: string[];
  /** Optional per-tool recipient cap (certificate). */
  certificateMaxRecipients?: number;
};

/**
 * Assemble a ToolSet from enabled tool IDs.
 *
 * Two categories of tools:
 *
 *   Special / global tools (hardcoded here, no manifest):
 *     'weather'        → weather + convertFahrenheitToCelsius
 *     'knowledge_base' → searchKnowledge + retrieveDocument
 *
 *   Registry-managed tools (delegated to features/tools/registry/server.ts):
 *     'exam_prep'   → quiz tools  (features/quiz/agent.ts → service.ts)
 *     'certificate' → cert tools  (features/certificate/agent.ts → service.ts)
 *     …any future tool registered in SERVER_REGISTRY
 *
 * To add a new registry tool, register it in features/tools/registry/server.ts.
 * No changes to this file are needed.
 */
export function buildToolSet({
  enabledToolIds,
  userId,
  brandId,
  documentIds,
  rerankEnabled,
  source,
  threadId,
  referenceImageUrls,
  certificateMaxRecipients,
}: BuildToolSetOptions): ToolSet {
  const ids = enabledToolIds ?? ALL_TOOL_IDS;

  const result: ToolSet = {};

  // ── Special / global tools ─────────────────────────────────────────────────
  if (ids.includes('weather')) {
    Object.assign(result, weatherTools);
  }

  if (ids.includes('knowledge_base') && documentIds && documentIds.length > 0) {
    Object.assign(result, createScopedRagTools(documentIds, { rerank: rerankEnabled ?? false }));
  }

  // ── Registry-managed tools (single delegation point) ──────────────────────
  const ctx: AgentToolContext = {
    userId,
    brandId,
    documentIds,
    rerankEnabled,
    source,
    threadId,
    referenceImageUrls,
    toolOptions: {
      certificateMaxRecipients,
    },
  };

  const registryTools = buildRegistryAgentTools(ids, ctx);
  Object.assign(result, registryTools);

  return result;
}
