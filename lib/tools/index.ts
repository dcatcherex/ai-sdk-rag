import type { ToolSet } from 'ai';
import { weatherTools } from './weather';
import { ragTools, createScopedRagTools } from './rag';
import { createCertificateTools } from './certificate';
import { ALL_TOOL_IDS } from '@/lib/tool-registry';

export { weatherTools, ragTools, createScopedRagTools };

export type BuildToolSetOptions = {
  /** Which tool groups to include. Pass null/undefined to include all defaults. */
  enabledToolIds: string[] | null;
  /** The user ID — needed for user-scoped tools (certificate). */
  userId: string;
  /** When set, RAG tools are scoped to these document IDs only. */
  documentIds?: string[];
  /** Enable Cohere cross-encoder reranking after hybrid retrieval. */
  rerankEnabled?: boolean;
};

/**
 * Assemble a ToolSet from enabled tool groups.
 * This is the single place that maps group IDs → actual tool objects.
 *
 * Tool groups:
 *   'weather'      → weather + convertFahrenheitToCelsius
 *   'knowledge_base' → searchKnowledge + retrieveDocument
 *   'certificate'  → list_certificate_templates + generate_certificate
 */
export function buildToolSet({ enabledToolIds, userId, documentIds, rerankEnabled }: BuildToolSetOptions): ToolSet {
  // null means "all tools enabled" (default for new users)
  const ids = enabledToolIds ?? ALL_TOOL_IDS;

  const result: ToolSet = {};

  if (ids.includes('weather')) {
    Object.assign(result, weatherTools);
  }

  if (ids.includes('knowledge_base') && documentIds && documentIds.length > 0) {
    Object.assign(result, createScopedRagTools(documentIds, { rerank: rerankEnabled ?? false }));
  }

  if (ids.includes('certificate')) {
    Object.assign(result, createCertificateTools(userId));
  }

  return result;
}
