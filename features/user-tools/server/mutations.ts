import { and, eq, exists, inArray, or } from "drizzle-orm";
import { nanoid } from "nanoid";

import {
  agent,
  agentShare,
  agentUserToolAttachment,
  brand,
  userTool,
  userToolShare,
  userToolWorkspaceShare,
  userToolVersion,
  workspaceMember,
} from "@/db/schema";
import { db } from "@/lib/db";
import type {
  AgentUserToolAttachmentInput,
  UserToolExecutionConfig,
  UserToolField,
} from "../types";
import {
  normalizeAgentUserToolAttachments,
  validateAttachableUserTools,
} from "./attachment-validation";
import { canEditUserTool } from "./permissions";
import { getEffectiveUserToolShareRoles, getUserToolById } from "./queries";

export async function createUserTool(input: {
  userId: string;
  name: string;
  slug: string;
  description?: string | null;
  icon?: string;
  category?: string;
  executionType: "webhook" | "workflow";
  visibility?: "private" | "shared" | "template" | "published";
  status?: "draft" | "active" | "archived";
  readOnly?: boolean;
  requiresConfirmation?: boolean;
  supportsAgent?: boolean;
  supportsManualRun?: boolean;
}) {
  const now = new Date();
  const row = {
    id: nanoid(),
    userId: input.userId,
    name: input.name,
    slug: input.slug,
    description: input.description ?? null,
    icon: input.icon ?? "Wrench",
    category: input.category ?? "utilities",
    executionType: input.executionType,
    visibility: input.visibility ?? "private",
    status: input.status ?? "draft",
    readOnly: input.readOnly ?? true,
    requiresConfirmation: input.requiresConfirmation ?? false,
    supportsAgent: input.supportsAgent ?? true,
    supportsManualRun: input.supportsManualRun ?? true,
    latestVersion: 0,
    activeVersion: null,
    createdAt: now,
    updatedAt: now,
  } as const;

  await db.insert(userTool).values(row);
  return row;
}

async function syncUserToolVisibilityWithShares(toolId: string) {
  const [directShare, workspaceShare] = await Promise.all([
    db.select({ id: userToolShare.id }).from(userToolShare).where(eq(userToolShare.toolId, toolId)).limit(1),
    db.select({ id: userToolWorkspaceShare.id }).from(userToolWorkspaceShare).where(eq(userToolWorkspaceShare.toolId, toolId)).limit(1),
  ]);

  await db.update(userTool)
    .set({
      visibility: directShare.length > 0 || workspaceShare.length > 0 ? "shared" : "private",
      updatedAt: new Date(),
    })
    .where(eq(userTool.id, toolId));
}

export async function updateUserTool(toolId: string, input: Partial<{
  name: string;
  slug: string;
  description: string | null;
  icon: string;
  category: string;
  executionType: "webhook" | "workflow";
  visibility: "private" | "shared" | "template" | "published";
  status: "draft" | "active" | "archived";
  readOnly: boolean;
  requiresConfirmation: boolean;
  supportsAgent: boolean;
  supportsManualRun: boolean;
}>, userId: string) {
  const row = await getUserToolById(toolId, userId);
  if (!row || !canEditUserTool({ userId, tool: row.tool, shareRole: row.shareRole })) {
    throw new Error("Unauthorized");
  }

  await db.update(userTool).set({
    ...input,
    updatedAt: new Date(),
  }).where(eq(userTool.id, toolId));

  return getUserToolById(toolId, userId);
}

export async function createUserToolVersion(params: {
  toolId: string;
  userId: string;
  inputSchema: UserToolField[];
  outputSchema?: UserToolField[];
  config: UserToolExecutionConfig;
  changeSummary?: string;
  isDraft?: boolean;
  activate?: boolean;
}) {
  const row = await getUserToolById(params.toolId, params.userId);
  if (!row || !canEditUserTool({ userId: params.userId, tool: row.tool, shareRole: row.shareRole })) {
    throw new Error("Unauthorized");
  }

  const nextVersion = row.tool.latestVersion + 1;
  const versionId = nanoid();
  await db.insert(userToolVersion).values({
    id: versionId,
    toolId: params.toolId,
    version: nextVersion,
    inputSchemaJson: params.inputSchema,
    outputSchemaJson: params.outputSchema ?? [],
    configJson: params.config,
    changeSummary: params.changeSummary ?? null,
    isDraft: params.isDraft ?? false,
    createdByUserId: params.userId,
  });

  await db.update(userTool).set({
    latestVersion: nextVersion,
    activeVersion: params.activate === false ? row.tool.activeVersion : nextVersion,
    updatedAt: new Date(),
  }).where(eq(userTool.id, params.toolId));

  return versionId;
}

export async function publishUserToolVersion(toolId: string, version: number, userId: string) {
  const row = await getUserToolById(toolId, userId);
  if (!row || !canEditUserTool({ userId, tool: row.tool, shareRole: row.shareRole })) {
    throw new Error("Unauthorized");
  }

  await db
    .update(userToolVersion)
    .set({ isDraft: false })
    .where(and(eq(userToolVersion.toolId, toolId), eq(userToolVersion.version, version)));

  await db.update(userTool).set({
    activeVersion: version,
    status: "active",
    updatedAt: new Date(),
  }).where(eq(userTool.id, toolId));
}

export async function replaceAgentUserToolAttachments(agentId: string, attachments: AgentUserToolAttachmentInput[], userId: string) {
  const normalizedAttachments = normalizeAgentUserToolAttachments(attachments);
  const agentRows = await db.select().from(agent).where(eq(agent.id, agentId)).limit(1);
  const agentRow = agentRows[0];
  if (!agentRow) throw new Error("Agent not found");

  const canAccessAgent = agentRow.userId === userId || await db.select({ id: agentShare.id })
    .from(agentShare)
    .where(and(eq(agentShare.agentId, agentId), eq(agentShare.sharedWithUserId, userId)))
    .limit(1)
    .then((rows) => rows.length > 0);
  if (!canAccessAgent) throw new Error("Unauthorized");

  if (normalizedAttachments.length > 0) {
    const requestedToolIds = normalizedAttachments.map((attachment) => attachment.userToolId);
    const [candidateTools, shareRoles] = await Promise.all([
      db
        .select({
          id: userTool.id,
          ownerId: userTool.userId,
          supportsAgent: userTool.supportsAgent,
          status: userTool.status,
        })
        .from(userTool)
        .where(inArray(userTool.id, requestedToolIds)),
      getEffectiveUserToolShareRoles(requestedToolIds, userId),
    ]);

    const accessibleTools = candidateTools
      .filter((tool) => tool.ownerId === userId || shareRoles.has(tool.id))
      .map(({ id, supportsAgent, status }) => ({ id, supportsAgent, status }));

    validateAttachableUserTools(normalizedAttachments, accessibleTools);
  }

  await db.delete(agentUserToolAttachment).where(eq(agentUserToolAttachment.agentId, agentId));
  if (normalizedAttachments.length === 0) return [];

  const rows = normalizedAttachments.map((attachment, index) => ({
    id: nanoid(),
    agentId,
    userToolId: attachment.userToolId,
    isEnabled: attachment.isEnabled ?? true,
    priority: attachment.priority ?? index,
    notes: attachment.notes ?? null,
  }));

  await db.insert(agentUserToolAttachment).values(rows);
  return rows;
}

export async function addUserToolShare(params: {
  toolId: string;
  ownerId: string;
  targetUserId: string;
  role?: "runner" | "editor";
}) {
  const row = await getUserToolById(params.toolId, params.ownerId);
  if (!row || row.tool.userId !== params.ownerId) {
    throw new Error("Unauthorized");
  }
  if (params.targetUserId === params.ownerId) {
    throw new Error("Cannot share a tool with yourself.");
  }

  await db.insert(userToolShare)
    .values({
      id: nanoid(),
      toolId: params.toolId,
      sharedWithUserId: params.targetUserId,
      role: params.role ?? "runner",
    })
    .onConflictDoUpdate({
      target: [userToolShare.toolId, userToolShare.sharedWithUserId],
      set: { role: params.role ?? "runner" },
    });

  await syncUserToolVisibilityWithShares(params.toolId);
}

export async function removeUserToolShare(params: {
  toolId: string;
  ownerId: string;
  targetUserId: string;
}) {
  const row = await getUserToolById(params.toolId, params.ownerId);
  if (!row || row.tool.userId !== params.ownerId) {
    throw new Error("Unauthorized");
  }

  await db.delete(userToolShare)
    .where(and(eq(userToolShare.toolId, params.toolId), eq(userToolShare.sharedWithUserId, params.targetUserId)));
  await syncUserToolVisibilityWithShares(params.toolId);
}

export async function addUserToolWorkspaceShare(params: {
  toolId: string;
  ownerId: string;
  brandId: string;
  role?: "runner" | "editor";
}) {
  const row = await getUserToolById(params.toolId, params.ownerId);
  if (!row || row.tool.userId !== params.ownerId) {
    throw new Error("Unauthorized");
  }

  const [shareableBrand] = await db
    .select({ id: brand.id })
    .from(brand)
    .where(
      and(
        eq(brand.id, params.brandId),
        or(
          eq(brand.userId, params.ownerId),
          exists(
            db.select({ id: workspaceMember.id })
              .from(workspaceMember)
              .where(
                and(
                  eq(workspaceMember.brandId, brand.id),
                  eq(workspaceMember.userId, params.ownerId),
                  eq(workspaceMember.role, "admin"),
                ),
              ),
          ),
        ),
      ),
    )
    .limit(1);

  if (!shareableBrand) {
    throw new Error("Workspace not found or not shareable.");
  }

  await db.insert(userToolWorkspaceShare)
    .values({
      id: nanoid(),
      toolId: params.toolId,
      brandId: params.brandId,
      role: params.role ?? "runner",
    })
    .onConflictDoUpdate({
      target: [userToolWorkspaceShare.toolId, userToolWorkspaceShare.brandId],
      set: { role: params.role ?? "runner" },
    });

  await syncUserToolVisibilityWithShares(params.toolId);
}

export async function removeUserToolWorkspaceShare(params: {
  toolId: string;
  ownerId: string;
  brandId: string;
}) {
  const row = await getUserToolById(params.toolId, params.ownerId);
  if (!row || row.tool.userId !== params.ownerId) {
    throw new Error("Unauthorized");
  }

  await db.delete(userToolWorkspaceShare)
    .where(and(eq(userToolWorkspaceShare.toolId, params.toolId), eq(userToolWorkspaceShare.brandId, params.brandId)));

  await syncUserToolVisibilityWithShares(params.toolId);
}
