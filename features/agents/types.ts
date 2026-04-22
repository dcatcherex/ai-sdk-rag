import type { AgentStructuredBehavior } from '@/lib/agent-structured-behavior';
import type { AgentSkillAttachment, AgentSkillAttachmentInput } from '@/features/skills/types';

export type CatalogScope = 'personal' | 'system';

export type McpServerConfig = {
  name: string;
  url: string;
  description?: string;
  authType?: 'none' | 'bearer' | 'api_key';
  credentialKey?: string;
};
export type CatalogStatus = 'draft' | 'published' | 'archived';
export type CloneBehavior = 'locked' | 'editable_copy';
export type UpdatePolicy = 'none' | 'notify' | 'auto_for_locked';
export type BrandMode = 'none' | 'optional' | 'suggested' | 'locked';
export type BrandAccessPolicy = 'no_brand' | 'any_accessible' | 'workspace_only' | 'specific_brand';
export type FallbackBehavior = 'ask_or_continue' | 'ask_to_select' | 'block_run' | 'use_default';

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
  brandMode: BrandMode;
  brandAccessPolicy: BrandAccessPolicy;
  requiresBrandForRun: boolean;
  fallbackBehavior: FallbackBehavior;
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
  mcpServers: McpServerConfig[];
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
  brandMode?: BrandMode;
  brandAccessPolicy?: BrandAccessPolicy;
  requiresBrandForRun?: boolean;
  fallbackBehavior?: FallbackBehavior;
  imageUrl?: string | null;
  isPublic?: boolean;
  isDefault?: boolean;
  starterPrompts?: string[];
  sharedUserIds?: string[];
  mcpServers?: McpServerConfig[];
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
