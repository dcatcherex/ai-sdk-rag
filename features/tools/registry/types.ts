// External provider execution modes — used when a tool delegates execution to an external service.
export type ToolExecutionMode = 'local' | 'external' | 'hybrid';

export type ExternalToolProviderMetadata = {
  providerKey: string;
  executionMode: ToolExecutionMode;
  supportsSync: boolean;
  supportsAsync: boolean;
  supportsConfigureUrl: boolean;
  supportsHealthCheck: boolean;
  estimatedCreditCost?: number;
  requiredPermissions?: string[];
  allowedSources?: Array<'agent' | 'sidebar' | 'api' | 'line'>;
};

export type ToolProviderHealthStatus = {
  providerKey: string;
  healthy: boolean;
  latencyMs?: number;
  checkedAt: string;
  error?: string;
};

export type ProfessionId =
  | 'all'
  | 'teacher'
  | 'marketer'
  | 'developer'
  | 'business'
  | 'minimal';

export type ToolCategory =
  | 'study'
  | 'content'
  | 'assessment'
  | 'admin'
  | 'utilities'
  | 'developer'
  | 'media'
  | 'agriculture';

export type ToolManifest = {
  /** Unique stable identifier used in DB, preferences, agent tool names */
  id: string;
  /** URL-safe slug — used in /tools/[toolSlug] routes */
  slug: string;
  title: string;
  description: string;
  /** Lucide icon name (string, not React component — server-safe) */
  icon: string;
  category: ToolCategory;
  /** Which profession presets this tool belongs to */
  professions: ProfessionId[];
  supportsAgent: boolean;
  supportsSidebar: boolean;
  supportsExport: boolean;
  /** Whether this tool is enabled by default for new users (drives DEFAULT_TOOL_IDS) */
  defaultEnabled: boolean;
  /** Optional workspace navigation metadata for tools that expose a sidebar page */
  sidebar?: {
    label?: string;
    defaultPinned?: boolean;
    order?: number;
  };
  access: {
    requiresAuth: boolean;
    roles?: Array<'user' | 'admin'>;
    /** Master on/off switch — false means tool is hidden everywhere */
    enabled: boolean;
  };
  /** Present only for tools that delegate execution to an external provider */
  provider?: ExternalToolProviderMetadata;
};

export type RegisteredTool = {
  manifest: ToolManifest;
  /** Returns the AI SDK tool definitions. Server-only — not imported on client. */
  getAgentDefinition?: (context: AgentToolContext) => Record<string, unknown>;
  /** Returns the href for the sidebar page link */
  getSidebarPageHref: () => string;
};

/** Context passed to agent tool factories */
export type AgentToolContext = {
  userId: string;
  brandId?: string;
  documentIds?: string[];
  rerankEnabled?: boolean;
  source?: 'manual' | 'agent';
  threadId?: string;
  referenceImageUrls?: string[];
  /** Per-tool options forwarded from buildToolSet callers */
  toolOptions?: {
    certificateMaxRecipients?: number;
  };
};

/**
 * Normalized execution result envelope.
 * Every tool — sidebar, API, or agent — returns this shape.
 */
export type ToolExecutionResult<TData = unknown> = {
  tool: string;
  runId: string;
  title: string;
  summary?: string;
  data: TData;
  artifacts?: Array<{
    type: 'pdf' | 'html' | 'link' | 'json';
    label: string;
    url: string;
  }>;
  createdAt: string;
};
