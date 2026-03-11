export type ToolGroup = 'utilities' | 'knowledge' | 'productivity';

export type ToolRegistryEntry = {
  label: string;
  description: string;
  group: ToolGroup;
  /** Whether this tool is enabled by default for new users */
  defaultEnabled: boolean;
};

export const TOOL_REGISTRY = {
  weather: {
    label: 'Weather',
    description: 'Get current weather for any location and convert temperatures.',
    group: 'utilities',
    defaultEnabled: true,
  },
  knowledge_base: {
    label: 'Knowledge Base',
    description: 'Search and retrieve information from your document library.',
    group: 'knowledge',
    defaultEnabled: true,
  },
  exam_prep: {
    label: 'Exam Prep',
    description: 'Create practice quizzes, grade answers, and build study plans from topics or documents.',
    group: 'productivity',
    defaultEnabled: false,
  },
  certificate: {
    label: 'Certificate Generator',
    description: 'Generate certificate images from templates with custom name, date, and other fields.',
    group: 'productivity',
    defaultEnabled: false,
  },
} as const satisfies Record<string, ToolRegistryEntry>;

export type ToolId = keyof typeof TOOL_REGISTRY;

export const ALL_TOOL_IDS = Object.keys(TOOL_REGISTRY) as ToolId[];

export const DEFAULT_TOOL_IDS = ALL_TOOL_IDS.filter(
  (id) => TOOL_REGISTRY[id].defaultEnabled,
);
