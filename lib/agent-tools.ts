import type { ToolSet } from 'ai';
import { baseTools } from './tools';
import { createScopedRagTools } from './rag-tool';

export { TOOL_REGISTRY, type ToolId } from './tool-registry';

export function createAgentTools(
  enabledTools: string[],
  documentIds?: string[],
): ToolSet {
  const result: ToolSet = {};

  if (enabledTools.includes('weather')) {
    result.weather = baseTools.weather;
    result.convertFahrenheitToCelsius = baseTools.convertFahrenheitToCelsius;
  }

  if (enabledTools.includes('knowledge_base')) {
    const ragTools = documentIds && documentIds.length > 0
      ? createScopedRagTools(documentIds)
      : createScopedRagTools([]);
    Object.assign(result, ragTools);
  }

  return result;
}
