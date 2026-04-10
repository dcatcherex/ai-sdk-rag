import type { WorkspaceMemberRole } from "@/features/collaboration/types";

export type MemoryScopeType =
  | "brand"
  | "workspace"
  | "project"
  | "agent"
  | "team"
  | "user"
  | "line_contact";

export type MemoryType = "shared_fact" | "continuity_note" | "agent_note";

export type MemoryStatus = "pending_review" | "approved" | "rejected" | "archived";

export type MemorySourceType = "manual" | "approved_extract" | "imported" | "agent_generated";

export type BrandMemoryRecord = {
  id: string;
  scopeType: MemoryScopeType;
  scopeId: string;
  memoryType: MemoryType;
  status: MemoryStatus;
  title: string;
  content: string;
  summary: string | null;
  category: string | null;
  sourceType: MemorySourceType;
  sourceThreadId: string | null;
  createdByUserId: string;
  approvedByUserId: string | null;
  rejectedByUserId: string | null;
  confidence: number;
  metadata: Record<string, unknown>;
  createdAt: Date | string;
  updatedAt: Date | string;
  approvedAt: Date | string | null;
  rejectedAt: Date | string | null;
  archivedAt: Date | string | null;
  lastReferencedAt: Date | string | null;
};

export type BrandMemoryPermission = {
  canRead: boolean;
  canWrite: boolean;
  isOwner: boolean;
  workspaceRole: WorkspaceMemberRole | null;
};

export type BrandMemoryListResponse = {
  records: BrandMemoryRecord[];
  permissions: BrandMemoryPermission;
};

export type ThreadWorkingMemoryRecord = {
  id: string;
  threadId: string;
  brandId: string | null;
  summary: string;
  currentObjective: string | null;
  decisions: string[];
  openQuestions: string[];
  importantContext: string[];
  recentArtifacts: string[];
  lastMessageId: string | null;
  refreshStatus: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  refreshedAt: Date | string | null;
  clearedAt: Date | string | null;
};
