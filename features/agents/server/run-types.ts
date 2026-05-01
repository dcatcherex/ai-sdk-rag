export type AgentRunChannel = 'web' | 'shared_link' | 'line';

export type AgentRunMode = 'text' | 'image' | 'video';

export type AgentRunIdentity = {
  channel: AgentRunChannel;
  userId: string | null;
  billingUserId: string;
  guestId?: string | null;
  lineUserId?: string | null;
  isOwner?: boolean;
};

export type AgentRunInputMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
  parts?: unknown[];
};

export type AgentRunPolicy = {
  maxSteps: number;
  allowTools: boolean;
  allowMcp: boolean;
  allowMemoryRead: boolean;
  allowMemoryWrite: boolean;
  allowPromptEnhancement: boolean;
  allowDirectImageGeneration: boolean;
  allowDirectVideoGeneration: boolean;
  responseFormat: 'ui_stream' | 'plain_text';
};

export type AgentRunRequest = {
  identity: AgentRunIdentity;
  threadId: string;
  agentId?: string | null;
  activeBrandId?: string | null;
  selectedDocumentIds?: string[];
  messages: AgentRunInputMessage[];
  model?: string | 'auto' | null;
  enabledModelIds?: string[];
  useWebSearch?: boolean;
  policy: AgentRunPolicy;
  channelContext?: Record<string, unknown>;
};

export type AgentRunTextResult = {
  type: 'text';
  text: string;
  toolCallCount: number;
  imageUrls: string[];
  responsePlan?: import('@/features/response-format').ResponsePlan;
  modelId: string;
  creditCost: number;
};

export type AgentRunImageStartedResult = {
  type: 'image_started';
  prompt: string;
  taskId: string;
  generationId: string;
  modelId: string;
  creditCost: number;
};

export type AgentRunResult = AgentRunTextResult | AgentRunImageStartedResult;
