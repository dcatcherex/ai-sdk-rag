export type AdminRunStatus = 'pending' | 'success' | 'error';

export type AdminChatRun = {
  id: string;
  userId: string;
  userName: string | null;
  userEmail: string | null;
  threadId: string;
  agentId: string | null;
  brandId: string | null;
  status: AdminRunStatus;
  routeKind: 'text' | 'image';
  requestedModelId: string | null;
  resolvedModelId: string | null;
  routingMode: 'manual' | 'auto' | null;
  routingReason: string | null;
  useWebSearch: boolean;
  usedTools: boolean;
  toolCallCount: number;
  creditCost: number | null;
  totalTokens: number | null;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
};

export type AdminChatRunDetail = AdminChatRun & {
  promptTokens: number | null;
  completionTokens: number | null;
  inputJson: Record<string, unknown> | null;
  outputJson: Record<string, unknown> | null;
  startedAt: string;
};

export type AdminChatRunsResponse = {
  summary: {
    totalRuns: number;
    successCount: number;
    errorCount: number;
    pendingCount: number;
    byRouteKind: Array<{ key: string; count: number }>;
    byResolvedModel: Array<{ key: string; count: number }>;
  };
  runs: AdminChatRun[];
  page: number;
  totalPages: number;
};

export type AdminWorkspaceAiRun = {
  id: string;
  userId: string;
  userName: string | null;
  userEmail: string | null;
  kind: string;
  entityType: 'agent' | 'skill';
  entityId: string | null;
  route: 'text' | 'image';
  status: AdminRunStatus;
  modelId: string | null;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
};

export type AdminWorkspaceAiRunDetail = AdminWorkspaceAiRun & {
  inputJson: Record<string, unknown> | null;
  outputJson: Record<string, unknown> | null;
};

export type AdminWorkspaceAiRunsResponse = {
  summary: {
    totalRuns: number;
    successCount: number;
    errorCount: number;
    pendingCount: number;
    byKind: Array<{ key: string; count: number }>;
    byRoute: Array<{ key: string; count: number }>;
    byModel: Array<{ key: string; count: number }>;
  };
  runs: AdminWorkspaceAiRun[];
  page: number;
  totalPages: number;
};

export type AdminToolRun = {
  id: string;
  userId: string;
  userName: string | null;
  userEmail: string | null;
  toolSlug: string;
  threadId: string | null;
  source: string;
  status: AdminRunStatus;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
};

export type AdminToolRunDetail = AdminToolRun & {
  inputJson: Record<string, unknown> | null;
  outputJson: Record<string, unknown> | null;
};

export type AdminToolRunsResponse = {
  summary: {
    totalRuns: number;
    successCount: number;
    errorCount: number;
    pendingCount: number;
    byToolSlug: Array<{ key: string; count: number }>;
    bySource: Array<{ key: string; count: number }>;
  };
  runs: AdminToolRun[];
  page: number;
  totalPages: number;
};

export type AdminUnifiedRun = {
  id: string;
  runtime: 'chat' | 'workspace' | 'tool';
  title: string;
  subtitle: string | null;
  userId: string;
  userName: string | null;
  userEmail: string | null;
  status: AdminRunStatus;
  createdAt: string;
  completedAt: string | null;
  routeKind: string | null;
  modelOrTarget: string | null;
};

export type AdminUnifiedRunsResponse = {
  summary: {
    totalRuns: number;
    successCount: number;
    errorCount: number;
    pendingCount: number;
    byRuntime: Array<{ key: string; count: number }>;
  };
  runs: AdminUnifiedRun[];
  page: number;
  totalPages: number;
};

export type RuntimeStats = {
  runCount: number;
  errorCount: number;
  tokenTotal: number;
  creditTotal: number;
};

export type AdminAiTrendsResponse = {
  range: { dateFrom: string; dateTo: string };
  summary: {
    totalRuns: number;
    totalErrors: number;
    totalTokens: number;
    totalCredits: number;
    byRuntime: {
      chat: RuntimeStats;
      workspace: RuntimeStats;
      tool: RuntimeStats;
    };
  };
  prevSummary: {
    totalRuns: number;
    totalErrors: number;
    totalTokens: number;
    totalCredits: number;
  };
  avgLatencyMs: number | null;
  daily: Array<{
    day: string;
    totalRuns: number;
    totalErrors: number;
    totalTokens: number;
    totalCredits: number;
    chat: RuntimeStats;
    workspace: RuntimeStats;
    tool: RuntimeStats;
  }>;
};
