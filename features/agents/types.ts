export type Agent = {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  systemPrompt: string;
  modelId: string | null;
  enabledTools: string[];
  createdAt: string | Date;
  updatedAt: string | Date;
};

export type CreateAgentInput = {
  name: string;
  description?: string;
  systemPrompt: string;
  modelId?: string | null;
  enabledTools?: string[];
};

export type UpdateAgentInput = Partial<CreateAgentInput>;
