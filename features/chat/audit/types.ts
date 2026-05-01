export type ChatRunStatus = "pending" | "success" | "error";

export type ChatRunRouteKind = "text" | "image";

export type ChatRunRoutingMode = "manual" | "auto";

export type ChatRunListItem = {
  id: string;
  threadId: string;
  agentId: string | null;
  brandId: string | null;
  status: ChatRunStatus;
  routeKind: ChatRunRouteKind;
  requestedModelId: string | null;
  resolvedModelId: string | null;
  routingMode: ChatRunRoutingMode | null;
  routingReason: string | null;
  useWebSearch: boolean;
  usedTools: boolean;
  toolCallCount: number;
  creditCost: number | null;
  totalTokens: number | null;
  responseIntent: string | null;
  responseFormats: string[];
  templateKey: string | null;
  quickReplyCount: number;
  escalationCreated: boolean;
  renderFallbackUsed: boolean;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
};

export type ChatRunsSummaryItem = {
  key: string;
  count: number;
};

export type ChatRunSummary = {
  totalRuns: number;
  successCount: number;
  errorCount: number;
  pendingCount: number;
  byRouteKind: ChatRunsSummaryItem[];
  byResolvedModel: ChatRunsSummaryItem[];
  byRoutingMode: ChatRunsSummaryItem[];
  byResponseIntent: ChatRunsSummaryItem[];
};

export type ChatRunsOverview = {
  summary: ChatRunSummary;
  runs: ChatRunListItem[];
};

export type ChatRunDetail = ChatRunListItem & {
  promptTokens: number | null;
  completionTokens: number | null;
  inputJson: Record<string, unknown>;
  outputJson: Record<string, unknown> | null;
  startedAt: string;
};
