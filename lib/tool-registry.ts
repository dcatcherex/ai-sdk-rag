export const TOOL_REGISTRY = {
  weather: {
    label: 'Weather Lookup',
    description: 'Get current weather for any location',
  },
  knowledge_base: {
    label: 'Knowledge Base',
    description: 'Search and retrieve from your document library',
  },
} as const;

export type ToolId = keyof typeof TOOL_REGISTRY;
