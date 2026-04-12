import type { AgentStructuredBehavior } from '@/lib/agent-structured-behavior';
import type { AgentSkillAttachment, AgentSkillAttachmentInput } from '@/features/skills/types';

export type CatalogScope = 'personal' | 'system';
export type CatalogStatus = 'draft' | 'published' | 'archived';
export type CloneBehavior = 'locked' | 'editable_copy';
export type UpdatePolicy = 'none' | 'notify' | 'auto_for_locked';

export type Agent = {
  id: string;
  userId: string | null;
  name: string;
  description: string | null;
  systemPrompt: string;
  structuredBehavior: AgentStructuredBehavior | null;
  modelId: string | null;
  enabledTools: string[];
  documentIds: string[];
  skillIds: string[];
  brandId: string | null;
  imageUrl: string | null;
  isPublic: boolean;
  starterPrompts: string[];
  isTemplate: boolean;
  templateId: string | null;
  isDefault: boolean;
  catalogScope: CatalogScope;
  catalogStatus: CatalogStatus;
  managedByAdmin: boolean;
  cloneBehavior: CloneBehavior;
  updatePolicy: UpdatePolicy;
  lockedFields: string[];
  version: number;
  sourceTemplateVersion: number | null;
  publishedAt: string | Date | null;
  archivedAt: string | Date | null;
  changelog: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
};

export type CreateAgentInput = {
  name: string;
  description?: string;
  systemPrompt: string;
  structuredBehavior?: AgentStructuredBehavior | null;
  modelId?: string | null;
  enabledTools?: string[];
  documentIds?: string[];
  skillAttachments?: AgentSkillAttachmentInput[];
  brandId?: string | null;
  imageUrl?: string | null;
  isPublic?: boolean;
  isDefault?: boolean;
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
  skillAttachments?: AgentSkillAttachment[];
};
