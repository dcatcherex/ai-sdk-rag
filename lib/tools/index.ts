import type { ToolSet } from 'ai';
import { weatherTools } from './weather';
import { ragTools, createScopedRagTools } from './rag';
import { ALL_TOOL_IDS } from '@/lib/tool-registry';
// Registry-managed tools — logic lives in features/<tool>/service.ts
import { createQuizAgentTools } from '@/features/quiz/agent';
import { createCertificateAgentTools } from '@/features/certificate/agent';

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
  /** Execution context for tools with side effects. */
  source?: 'manual' | 'agent';
  /** Optional per-tool recipient cap. */
  certificateMaxRecipients?: number;
};

/**
 * Assemble a ToolSet from enabled tool groups.
 * This is the single place that maps group IDs → actual tool objects.
 *
 * Tool groups:
 *   'weather'        → weather + convertFahrenheitToCelsius
 *   'knowledge_base' → searchKnowledge + retrieveDocument
 *   'exam_prep'      → quiz/exam-prep tools (features/quiz/agent.ts → features/quiz/service.ts)
 *   'certificate'    → certificate tools (features/certificate/agent.ts → features/certificate/service.ts)
 */
export function buildToolSet({ enabledToolIds, userId, documentIds, rerankEnabled, source, certificateMaxRecipients }: BuildToolSetOptions): ToolSet {
  // null means "all tools enabled" (default for new users)
  const ids = enabledToolIds ?? ALL_TOOL_IDS;

  const result: ToolSet = {};

  if (ids.includes('weather')) {
    Object.assign(result, weatherTools);
  }

  if (ids.includes('knowledge_base') && documentIds && documentIds.length > 0) {
    Object.assign(result, createScopedRagTools(documentIds, { rerank: rerankEnabled ?? false }));
  }

  if (ids.includes('exam_prep')) {
    Object.assign(result, createQuizAgentTools({ documentIds, rerankEnabled }));
  }

  if (ids.includes('certificate')) {
    Object.assign(result, createCertificateAgentTools({
      userId,
      source,
      maxRecipients: certificateMaxRecipients,
    }));
  }

  return result;
}
