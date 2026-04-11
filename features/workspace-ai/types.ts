export type WorkspaceTextAssistKind =
  | 'agent-description'
  | 'agent-starters'
  | 'skill-description';

export type WorkspaceAssistEntityType = 'agent' | 'skill';

export type WorkspaceTextAssistContext = {
  entityId?: string;
  entityType: WorkspaceAssistEntityType;
  name?: string;
  systemPrompt?: string;
  promptFragment?: string;
  currentValue?: string;
  extra?: Record<string, unknown>;
};

export type WorkspaceTextAssistRequest = {
  kind: WorkspaceTextAssistKind;
  targetLocale?: string;
  tone?: string;
  instruction?: string;
  context: WorkspaceTextAssistContext;
};

export type WorkspaceTextAssistResult = {
  kind: WorkspaceTextAssistKind;
  suggestions: string[];
  modelId: string;
};

export type WorkspaceImageAssistKind = 'agent-cover';

export type WorkspaceImageAssistRequest = {
  kind: WorkspaceImageAssistKind;
  instruction?: string;
  modelId?: string;
  aspectRatio?: string;
  context: WorkspaceTextAssistContext;
};

export type WorkspaceImageAssistResult = {
  kind: WorkspaceImageAssistKind;
  modelId: string;
  prompt: string;
  taskId: string;
  generationId: string;
};

export type WorkspaceAiRunStatus = 'pending' | 'success' | 'error';

export type WorkspaceAiRunListItem = {
  id: string;
  kind: string;
  route: 'text' | 'image';
  status: WorkspaceAiRunStatus;
  entityType: WorkspaceAssistEntityType;
  entityId: string | null;
  modelId: string | null;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
};

export type WorkspaceAiRunsSummaryItem = {
  key: string;
  count: number;
};

export type WorkspaceAiRunsOverview = {
  summary: {
    totalRuns: number;
    successCount: number;
    errorCount: number;
    pendingCount: number;
    byKind: WorkspaceAiRunsSummaryItem[];
    byRoute: WorkspaceAiRunsSummaryItem[];
  };
  runs: WorkspaceAiRunListItem[];
};
