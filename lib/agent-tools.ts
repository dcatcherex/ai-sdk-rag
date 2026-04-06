import type { ToolSet } from 'ai';
import { buildToolSet } from './tools/index';

export { TOOL_REGISTRY, ALL_TOOL_IDS, DEFAULT_TOOL_IDS, type ToolId } from './tool-registry';

export function createAgentTools(
  enabledTools: string[] | null,
  userId: string,
  documentIds?: string[],
): ToolSet {
  return buildToolSet({
    enabledToolIds: enabledTools,
    userId,
    documentIds,
    source: 'agent',
    certificateMaxRecipients: 50,
  });
}
