export type Agent = {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  systemPrompt: string;
  modelId: string | null;
  enabledTools: string[];
  documentIds: string[];
  isPublic: boolean;
  createdAt: string | Date;
  updatedAt: string | Date;
};

export type CreateAgentInput = {
  name: string;
  description?: string;
  systemPrompt: string;
  modelId?: string | null;
  enabledTools?: string[];
  documentIds?: string[];
  isPublic?: boolean;
  sharedUserIds?: string[];
};

export type UpdateAgentInput = Partial<CreateAgentInput>;

export type SharedUser = {
  id: string;
  name: string;
  email: string;
  image?: string | null;
};

export type AgentWithSharing = Agent & {
  ownerName?: string;
  sharedWith?: SharedUser[];
};
