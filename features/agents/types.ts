export type Agent = {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  systemPrompt: string;
  modelId: string | null;
  enabledTools: string[];
  documentIds: string[];
  skillIds: string[];
  brandId: string | null;
  isPublic: boolean;
  starterPrompts: string[];
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
  skillIds?: string[];
  brandId?: string | null;
  isPublic?: boolean;
  starterPrompts?: string[];
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
