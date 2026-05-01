export type PlatformToolResult = {
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
  actionUrl?: string;
};

export type WorkspaceContext = {
  agentCount: number;
  skillCount: number;
  threadCount: number;
  creditBalance: number;
  lineOaConnected: boolean;
  recentAgents: Array<{ id: string; name: string }>;
  recentThreads: Array<{
    id: string;
    title: string;
    agentName: string;
    updatedAt: string;
  }>;
};

export type OnboardingPlan = {
  agentId: string;
  agentName: string;
  skillsInstalled: string[];
  suggestedStarters: string[];
};

export type CreateAgentInput = {
  name: string;
  systemPrompt: string;
  description?: string;
  modelId?: string;
  skillIds?: string[];
  starterTasks?: import('@/features/chat/components/empty-state/types').AgentStarterTask[];
};

export type InstallSkillInput = {
  skillId?: string;
  githubUrl?: string;
  agentId?: string;
};

export type CreateThreadInput = {
  agentId?: string;
  title?: string;
  initialMessage?: string;
};
