import { and, eq } from 'drizzle-orm';

import { brand, brandShare, workspaceMember } from '@/db/schema';
import type { ResponseWorkflowCapability } from '@/features/response-format/types';

type WorkspaceRole = 'admin' | 'editor' | 'reviewer' | 'writer' | null;

export type ResolveResponseWorkflowCapabilitiesInput = {
  actorUserId?: string | null;
  brandId?: string | null;
  isOwner?: boolean;
};

export type DeriveResponseWorkflowCapabilitiesInput = {
  isOwner?: boolean;
  workspaceRole?: WorkspaceRole;
  hasBrandShare?: boolean;
  isAuthenticated?: boolean;
};

export function deriveResponseWorkflowCapabilities(
  input: DeriveResponseWorkflowCapabilitiesInput,
): ResponseWorkflowCapability[] {
  const capabilities = new Set<ResponseWorkflowCapability>();

  capabilities.add('workflow.request_human_review');

  if (input.isOwner) {
    capabilities.add('workflow.assign_reviewer');
    capabilities.add('workflow.view_review_queue');
    capabilities.add('workflow.resolve');
    capabilities.add('conversation.read_escalated');
    return [...capabilities];
  }

  switch (input.workspaceRole) {
    case 'admin':
      capabilities.add('workflow.assign_reviewer');
      capabilities.add('workflow.view_review_queue');
      capabilities.add('workflow.resolve');
      capabilities.add('conversation.read_escalated');
      break;
    case 'reviewer':
      capabilities.add('workflow.view_review_queue');
      capabilities.add('workflow.resolve');
      capabilities.add('conversation.read_escalated');
      break;
    case 'editor':
      capabilities.add('workflow.view_review_queue');
      capabilities.add('conversation.read_escalated');
      break;
    case 'writer':
    default:
      break;
  }

  if (input.hasBrandShare && input.isAuthenticated) {
    capabilities.add('conversation.read_escalated');
  }

  return [...capabilities];
}

export async function listResponseWorkflowCapabilities(
  input: ResolveResponseWorkflowCapabilitiesInput,
): Promise<ResponseWorkflowCapability[]> {
  const { db } = await import('@/lib/db');
  const actorUserId = input.actorUserId?.trim() || null;
  if (!actorUserId) {
    return deriveResponseWorkflowCapabilities({ isAuthenticated: false });
  }

  const brandId = input.brandId?.trim() || null;
  if (!brandId) {
    return deriveResponseWorkflowCapabilities({
      isOwner: input.isOwner,
      isAuthenticated: true,
    });
  }

  const [brandOwnerRows, workspaceRows, sharedRows] = await Promise.all([
    db
      .select({ userId: brand.userId })
      .from(brand)
      .where(and(eq(brand.id, brandId), eq(brand.userId, actorUserId)))
      .limit(1),
    db
      .select({ role: workspaceMember.role })
      .from(workspaceMember)
      .where(and(eq(workspaceMember.brandId, brandId), eq(workspaceMember.userId, actorUserId)))
      .limit(1),
    db
      .select({ shared: brandShare.id })
      .from(brandShare)
      .where(and(eq(brandShare.brandId, brandId), eq(brandShare.sharedWithUserId, actorUserId)))
      .limit(1),
  ]);

  return deriveResponseWorkflowCapabilities({
    isOwner: Boolean(input.isOwner || brandOwnerRows[0]),
    workspaceRole: (workspaceRows[0]?.role as WorkspaceRole | undefined) ?? null,
    hasBrandShare: Boolean(sharedRows[0]),
    isAuthenticated: true,
  });
}

export async function canAccessEscalatedConversation(
  input: ResolveResponseWorkflowCapabilitiesInput,
): Promise<boolean> {
  const capabilities = await listResponseWorkflowCapabilities(input);
  return capabilities.includes('conversation.read_escalated');
}

export async function canAssignReviewerForBrand(
  input: ResolveResponseWorkflowCapabilitiesInput,
): Promise<boolean> {
  const capabilities = await listResponseWorkflowCapabilities(input);
  return capabilities.includes('workflow.assign_reviewer');
}
