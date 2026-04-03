import { eq, and, or, isNull, asc } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '@/lib/db';
import {
  workspaceMember,
  approvalRequest,
  contentComment,
  contentPiece,
  user,
} from '@/db/schema';
import { sendEmail } from '@/lib/email';
import type {
  WorkspaceMember,
  WorkspaceMemberRole,
  ApprovalRequest,
  ApprovalStatus,
  ContentComment,
} from './types';

// ── Workspace Members ─────────────────────────────────────────────────────────

export async function getWorkspaceMembers(brandId: string): Promise<WorkspaceMember[]> {
  const rows = await db
    .select({
      id: workspaceMember.id,
      brandId: workspaceMember.brandId,
      userId: workspaceMember.userId,
      role: workspaceMember.role,
      invitedBy: workspaceMember.invitedBy,
      joinedAt: workspaceMember.joinedAt,
      createdAt: workspaceMember.createdAt,
      userName: user.name,
      userEmail: user.email,
      userImage: user.image,
    })
    .from(workspaceMember)
    .innerJoin(user, eq(workspaceMember.userId, user.id))
    .where(eq(workspaceMember.brandId, brandId))
    .orderBy(asc(workspaceMember.createdAt));

  return rows.map((r) => ({
    ...r,
    role: r.role as WorkspaceMemberRole,
  }));
}

export async function addWorkspaceMember(
  brandId: string,
  userId: string,
  role: WorkspaceMemberRole,
  invitedBy: string,
): Promise<WorkspaceMember> {
  const id = nanoid();
  await db
    .insert(workspaceMember)
    .values({ id, brandId, userId, role, invitedBy, joinedAt: new Date(), createdAt: new Date() })
    .onConflictDoNothing();

  const members = await getWorkspaceMembers(brandId);
  const member = members.find((m) => m.userId === userId);
  if (!member) {
    // Already existed — fetch it
    const existing = await db
      .select({
        id: workspaceMember.id,
        brandId: workspaceMember.brandId,
        userId: workspaceMember.userId,
        role: workspaceMember.role,
        invitedBy: workspaceMember.invitedBy,
        joinedAt: workspaceMember.joinedAt,
        createdAt: workspaceMember.createdAt,
        userName: user.name,
        userEmail: user.email,
        userImage: user.image,
      })
      .from(workspaceMember)
      .innerJoin(user, eq(workspaceMember.userId, user.id))
      .where(and(eq(workspaceMember.brandId, brandId), eq(workspaceMember.userId, userId)))
      .limit(1);
    return { ...existing[0], role: existing[0].role as WorkspaceMemberRole };
  }
  return member;
}

export async function updateWorkspaceMemberRole(
  brandId: string,
  userId: string,
  role: WorkspaceMemberRole,
): Promise<void> {
  await db
    .update(workspaceMember)
    .set({ role })
    .where(and(eq(workspaceMember.brandId, brandId), eq(workspaceMember.userId, userId)));
}

export async function removeWorkspaceMember(brandId: string, userId: string): Promise<void> {
  await db
    .delete(workspaceMember)
    .where(and(eq(workspaceMember.brandId, brandId), eq(workspaceMember.userId, userId)));
}

export async function getUserBrandRole(
  userId: string,
  brandId: string,
): Promise<WorkspaceMemberRole | null> {
  const rows = await db
    .select({ role: workspaceMember.role })
    .from(workspaceMember)
    .where(and(eq(workspaceMember.userId, userId), eq(workspaceMember.brandId, brandId)))
    .limit(1);

  if (rows.length === 0) return null;
  return rows[0].role as WorkspaceMemberRole;
}

// ── Approval Requests ─────────────────────────────────────────────────────────

export async function getApprovalQueue(
  brandId: string,
  userId: string,
): Promise<ApprovalRequest[]> {
  const requester = db.select({ name: user.name }).from(user).where(eq(user.id, approvalRequest.requesterId)).as('requester');
  const assignee = db.select({ name: user.name }).from(user).where(eq(user.id, approvalRequest.assigneeId!)).as('assignee');

  const rows = await db
    .select({
      id: approvalRequest.id,
      contentPieceId: approvalRequest.contentPieceId,
      brandId: approvalRequest.brandId,
      requesterId: approvalRequest.requesterId,
      assigneeId: approvalRequest.assigneeId,
      status: approvalRequest.status,
      dueAt: approvalRequest.dueAt,
      resolvedAt: approvalRequest.resolvedAt,
      resolutionNote: approvalRequest.resolutionNote,
      createdAt: approvalRequest.createdAt,
      updatedAt: approvalRequest.updatedAt,
      contentPieceTitle: contentPiece.title,
    })
    .from(approvalRequest)
    .innerJoin(contentPiece, eq(approvalRequest.contentPieceId, contentPiece.id))
    .where(
      and(
        eq(approvalRequest.brandId, brandId),
        eq(approvalRequest.status, 'pending'),
        or(isNull(approvalRequest.assigneeId), eq(approvalRequest.assigneeId, userId)),
      ),
    )
    .orderBy(asc(approvalRequest.createdAt));

  // Fetch requester/assignee names separately for simplicity
  const userIds = [...new Set(rows.flatMap((r) => [r.requesterId, r.assigneeId].filter(Boolean) as string[]))];
  const userMap = new Map<string, string>();
  if (userIds.length > 0) {
    const users = await db.select({ id: user.id, name: user.name }).from(user).where(
      or(...userIds.map((id) => eq(user.id, id))),
    );
    users.forEach((u) => userMap.set(u.id, u.name));
  }

  return rows.map((r) => ({
    ...r,
    status: r.status as ApprovalStatus,
    requesterName: userMap.get(r.requesterId),
    assigneeName: r.assigneeId ? (userMap.get(r.assigneeId) ?? null) : null,
  }));
}

export async function getUserApprovalRequests(userId: string): Promise<ApprovalRequest[]> {
  const rows = await db
    .select({
      id: approvalRequest.id,
      contentPieceId: approvalRequest.contentPieceId,
      brandId: approvalRequest.brandId,
      requesterId: approvalRequest.requesterId,
      assigneeId: approvalRequest.assigneeId,
      status: approvalRequest.status,
      dueAt: approvalRequest.dueAt,
      resolvedAt: approvalRequest.resolvedAt,
      resolutionNote: approvalRequest.resolutionNote,
      createdAt: approvalRequest.createdAt,
      updatedAt: approvalRequest.updatedAt,
      contentPieceTitle: contentPiece.title,
    })
    .from(approvalRequest)
    .innerJoin(contentPiece, eq(approvalRequest.contentPieceId, contentPiece.id))
    .where(eq(approvalRequest.requesterId, userId))
    .orderBy(asc(approvalRequest.createdAt));

  const assigneeIds = [...new Set(rows.map((r) => r.assigneeId).filter(Boolean) as string[])];
  const userMap = new Map<string, string>();
  if (assigneeIds.length > 0) {
    const users = await db.select({ id: user.id, name: user.name }).from(user).where(
      or(...assigneeIds.map((id) => eq(user.id, id))),
    );
    users.forEach((u) => userMap.set(u.id, u.name));
  }

  return rows.map((r) => ({
    ...r,
    status: r.status as ApprovalStatus,
    assigneeName: r.assigneeId ? (userMap.get(r.assigneeId) ?? null) : null,
  }));
}

export async function createApprovalRequest(data: {
  contentPieceId: string;
  brandId?: string | null;
  requesterId: string;
  assigneeId?: string | null;
  dueAt?: Date | null;
}): Promise<ApprovalRequest> {
  const id = nanoid();
  const now = new Date();
  await db.insert(approvalRequest).values({
    id,
    contentPieceId: data.contentPieceId,
    brandId: data.brandId ?? null,
    requesterId: data.requesterId,
    assigneeId: data.assigneeId ?? null,
    status: 'pending',
    dueAt: data.dueAt ?? null,
    createdAt: now,
    updatedAt: now,
  });

  // Update contentPiece status to 'in_review'
  await db
    .update(contentPiece)
    .set({ status: 'in_review' })
    .where(eq(contentPiece.id, data.contentPieceId));

  // Send email notification to assignee if provided
  if (data.assigneeId) {
    try {
      const assignees = await db
        .select({ email: user.email, name: user.name })
        .from(user)
        .where(eq(user.id, data.assigneeId))
        .limit(1);
      if (assignees.length > 0) {
        await sendEmail({
          to: assignees[0].email,
          subject: 'New approval request assigned to you',
          text: `Hello ${assignees[0].name},\n\nA new content piece has been submitted for your review. Please log in to approve, request changes, or reject.\n\nThank you.`,
        });
      }
    } catch (err) {
      console.error('[createApprovalRequest] email notification failed:', err);
    }
  }

  const requests = await getUserApprovalRequests(data.requesterId);
  return requests.find((r) => r.id === id) ?? {
    id,
    contentPieceId: data.contentPieceId,
    brandId: data.brandId ?? null,
    requesterId: data.requesterId,
    assigneeId: data.assigneeId ?? null,
    status: 'pending' as ApprovalStatus,
    dueAt: data.dueAt ?? null,
    resolvedAt: null,
    resolutionNote: null,
    createdAt: now,
    updatedAt: now,
  };
}

export async function resolveApprovalRequest(
  requestId: string,
  resolverId: string,
  resolution: {
    status: 'approved' | 'rejected' | 'changes_requested';
    note?: string;
  },
): Promise<ApprovalRequest> {
  const now = new Date();

  const existing = await db
    .select()
    .from(approvalRequest)
    .where(eq(approvalRequest.id, requestId))
    .limit(1);

  if (existing.length === 0) {
    throw new Error('Approval request not found');
  }

  const current = existing[0];
  if (current.status !== 'pending') {
    throw new Error(`Cannot resolve request with status '${current.status}'`);
  }

  await db
    .update(approvalRequest)
    .set({
      status: resolution.status,
      resolvedAt: now,
      resolutionNote: resolution.note ?? null,
      updatedAt: now,
    })
    .where(eq(approvalRequest.id, requestId));

  // Update contentPiece status
  const newContentStatus =
    resolution.status === 'approved'
      ? 'approved'
      : 'draft';

  await db
    .update(contentPiece)
    .set({ status: newContentStatus })
    .where(eq(contentPiece.id, current.contentPieceId));

  // Notify requester
  try {
    const requesters = await db
      .select({ email: user.email, name: user.name })
      .from(user)
      .where(eq(user.id, current.requesterId))
      .limit(1);
    if (requesters.length > 0) {
      const statusLabel =
        resolution.status === 'approved'
          ? 'approved'
          : resolution.status === 'rejected'
          ? 'rejected'
          : 'returned for changes';
      await sendEmail({
        to: requesters[0].email,
        subject: `Your content review has been ${statusLabel}`,
        text: `Hello ${requesters[0].name},\n\nYour content submission has been ${statusLabel}.${resolution.note ? `\n\nNote: ${resolution.note}` : ''}\n\nThank you.`,
      });
    }
  } catch (err) {
    console.error('[resolveApprovalRequest] email notification failed:', err);
  }

  const updated = await db
    .select({
      id: approvalRequest.id,
      contentPieceId: approvalRequest.contentPieceId,
      brandId: approvalRequest.brandId,
      requesterId: approvalRequest.requesterId,
      assigneeId: approvalRequest.assigneeId,
      status: approvalRequest.status,
      dueAt: approvalRequest.dueAt,
      resolvedAt: approvalRequest.resolvedAt,
      resolutionNote: approvalRequest.resolutionNote,
      createdAt: approvalRequest.createdAt,
      updatedAt: approvalRequest.updatedAt,
      contentPieceTitle: contentPiece.title,
    })
    .from(approvalRequest)
    .innerJoin(contentPiece, eq(approvalRequest.contentPieceId, contentPiece.id))
    .where(eq(approvalRequest.id, requestId))
    .limit(1);

  return { ...updated[0], status: updated[0].status as ApprovalStatus };
}

// ── Comments ──────────────────────────────────────────────────────────────────

export async function getContentComments(contentPieceId: string): Promise<ContentComment[]> {
  const rows = await db
    .select({
      id: contentComment.id,
      contentPieceId: contentComment.contentPieceId,
      userId: contentComment.userId,
      parentId: contentComment.parentId,
      body: contentComment.body,
      resolved: contentComment.resolved,
      resolvedBy: contentComment.resolvedBy,
      createdAt: contentComment.createdAt,
      updatedAt: contentComment.updatedAt,
      userName: user.name,
      userImage: user.image,
    })
    .from(contentComment)
    .innerJoin(user, eq(contentComment.userId, user.id))
    .where(eq(contentComment.contentPieceId, contentPieceId))
    .orderBy(asc(contentComment.createdAt));

  return rows;
}

export async function createComment(data: {
  contentPieceId: string;
  userId: string;
  parentId?: string | null;
  body: string;
}): Promise<ContentComment> {
  const id = nanoid();
  const now = new Date();
  await db.insert(contentComment).values({
    id,
    contentPieceId: data.contentPieceId,
    userId: data.userId,
    parentId: data.parentId ?? null,
    body: data.body,
    resolved: false,
    createdAt: now,
    updatedAt: now,
  });

  const rows = await db
    .select({
      id: contentComment.id,
      contentPieceId: contentComment.contentPieceId,
      userId: contentComment.userId,
      parentId: contentComment.parentId,
      body: contentComment.body,
      resolved: contentComment.resolved,
      resolvedBy: contentComment.resolvedBy,
      createdAt: contentComment.createdAt,
      updatedAt: contentComment.updatedAt,
      userName: user.name,
      userImage: user.image,
    })
    .from(contentComment)
    .innerJoin(user, eq(contentComment.userId, user.id))
    .where(eq(contentComment.id, id))
    .limit(1);

  return rows[0];
}

export async function resolveComment(commentId: string, resolvedBy: string): Promise<void> {
  await db
    .update(contentComment)
    .set({ resolved: true, resolvedBy, updatedAt: new Date() })
    .where(eq(contentComment.id, commentId));
}

export async function deleteComment(userId: string, commentId: string): Promise<void> {
  await db
    .delete(contentComment)
    .where(and(eq(contentComment.id, commentId), eq(contentComment.userId, userId)));
}
