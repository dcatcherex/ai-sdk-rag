import { and, desc, eq, exists, inArray, or } from "drizzle-orm";

import {
  agent,
  agentShare,
  agentUserToolAttachment,
  brand,
  toolRun,
  user as userTable,
  userTool,
  userToolShare,
  userToolWorkspaceShare,
  userToolVersion,
  workspaceMember,
} from "@/db/schema";
import { db } from "@/lib/db";
import type {
  UserToolShareRole,
  UserToolShareableWorkspace,
  UserToolSharedUser,
  UserToolSharedWorkspace,
} from "../types";
import { resolveEffectiveUserToolShareRole } from "./share-resolution";

export async function getUserToolsForUser(userId: string) {
  return db
    .select()
    .from(userTool)
    .where(
      or(
        eq(userTool.userId, userId),
        exists(
          db.select({ id: userToolShare.id })
            .from(userToolShare)
            .where(and(eq(userToolShare.toolId, userTool.id), eq(userToolShare.sharedWithUserId, userId))),
        ),
        exists(
          db.select({ id: userToolWorkspaceShare.id })
            .from(userToolWorkspaceShare)
            .innerJoin(workspaceMember, eq(workspaceMember.brandId, userToolWorkspaceShare.brandId))
            .where(and(eq(userToolWorkspaceShare.toolId, userTool.id), eq(workspaceMember.userId, userId))),
        ),
      ),
    )
    .orderBy(desc(userTool.updatedAt));
}

export async function getUserToolById(toolId: string, userId: string) {
  const rows = await db.select().from(userTool).where(eq(userTool.id, toolId)).limit(1);
  const tool = rows[0];
  if (!tool) {
    return null;
  }

  if (tool.userId === userId) {
    return { tool, shareRole: null };
  }

  const shareRole = await getEffectiveUserToolShareRole(tool.id, userId);
  if (!shareRole) {
    return null;
  }

  return { tool, shareRole };
}

export async function getUserToolActiveVersion(toolId: string, activeVersion: number | null) {
  if (activeVersion === null) return null;
  const rows = await db.select().from(userToolVersion)
    .where(and(eq(userToolVersion.toolId, toolId), eq(userToolVersion.version, activeVersion)))
    .limit(1);
  return rows[0] ?? null;
}

export async function getUserToolVersions(toolId: string) {
  return db.select().from(userToolVersion)
    .where(eq(userToolVersion.toolId, toolId))
    .orderBy(desc(userToolVersion.version));
}

export async function getUserToolShareList(toolId: string, userId: string): Promise<UserToolSharedUser[]> {
  const toolRows = await db.select({ id: userTool.id }).from(userTool)
    .where(and(eq(userTool.id, toolId), eq(userTool.userId, userId)))
    .limit(1);

  if (toolRows.length === 0) {
    throw new Error("Unauthorized");
  }

  const rows = await db
    .select({
      id: userTable.id,
      name: userTable.name,
      email: userTable.email,
      image: userTable.image,
      role: userToolShare.role,
    })
    .from(userToolShare)
    .innerJoin(userTable, eq(userToolShare.sharedWithUserId, userTable.id))
    .where(eq(userToolShare.toolId, toolId))
    .orderBy(userTable.name);

  return rows.map((row) => ({
    ...row,
    role: row.role as UserToolShareRole,
  }));
}

export async function getUserToolWorkspaceShareList(
  toolId: string,
  userId: string,
): Promise<UserToolSharedWorkspace[]> {
  const toolRows = await db.select({ id: userTool.id }).from(userTool)
    .where(and(eq(userTool.id, toolId), eq(userTool.userId, userId)))
    .limit(1);

  if (toolRows.length === 0) {
    throw new Error("Unauthorized");
  }

  const rows = await db
    .select({
      brandId: brand.id,
      brandName: brand.name,
      role: userToolWorkspaceShare.role,
    })
    .from(userToolWorkspaceShare)
    .innerJoin(brand, eq(userToolWorkspaceShare.brandId, brand.id))
    .where(eq(userToolWorkspaceShare.toolId, toolId))
    .orderBy(brand.name);

  return rows.map((row) => ({
    brandId: row.brandId,
    brandName: row.brandName,
    role: row.role as UserToolShareRole,
  }));
}

export async function getUserToolShareableWorkspaces(userId: string): Promise<UserToolShareableWorkspace[]> {
  const [ownedBrands, adminBrands] = await Promise.all([
    db
      .select({ id: brand.id, name: brand.name })
      .from(brand)
      .where(eq(brand.userId, userId))
      .orderBy(brand.name),
    db
      .select({ id: brand.id, name: brand.name })
      .from(workspaceMember)
      .innerJoin(brand, eq(workspaceMember.brandId, brand.id))
      .where(and(eq(workspaceMember.userId, userId), eq(workspaceMember.role, "admin")))
      .orderBy(brand.name),
  ]);

  const byId = new Map<string, UserToolShareableWorkspace>();
  ownedBrands.forEach((entry) => {
    byId.set(entry.id, { id: entry.id, name: entry.name, access: "owner" });
  });
  adminBrands.forEach((entry) => {
    if (!byId.has(entry.id)) {
      byId.set(entry.id, { id: entry.id, name: entry.name, access: "admin" });
    }
  });

  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export async function getRunnableUserToolsForAgent(agentId: string, userId: string) {
  const rows = await db
    .select({
      tool: userTool,
      attachment: agentUserToolAttachment,
    })
    .from(agentUserToolAttachment)
    .innerJoin(userTool, eq(agentUserToolAttachment.userToolId, userTool.id))
    .innerJoin(agent, eq(agent.id, agentUserToolAttachment.agentId))
    .where(
      and(
        eq(agentUserToolAttachment.agentId, agentId),
        eq(agentUserToolAttachment.isEnabled, true),
        or(
          eq(agent.userId, userId),
          exists(
            db.select({ id: agentShare.id })
              .from(agentShare)
              .where(and(eq(agentShare.agentId, agent.id), eq(agentShare.sharedWithUserId, userId))),
          ),
        ),
      ),
    );

  if (rows.length === 0) {
    return [];
  }

  const shareRoles = await getEffectiveUserToolShareRoles(rows.map(({ tool }) => tool.id), userId);
  return rows
    .map((row) => ({
      ...row,
      shareRole: row.tool.userId === userId ? null : shareRoles.get(row.tool.id) ?? null,
    }))
    .filter((row) => row.tool.userId === userId || row.shareRole !== null);
}

export async function getAgentUserToolAttachments(agentId: string, userId: string) {
  const agentRows = await db.select().from(agent).where(eq(agent.id, agentId)).limit(1);
  const agentRow = agentRows[0];
  if (!agentRow) return null;
  const canAccessAgent = agentRow.userId === userId || await db.select({ id: agentShare.id })
    .from(agentShare)
    .where(and(eq(agentShare.agentId, agentId), eq(agentShare.sharedWithUserId, userId)))
    .limit(1)
    .then((rows) => rows.length > 0);
  if (!canAccessAgent) return null;

  return db.select().from(agentUserToolAttachment)
    .where(eq(agentUserToolAttachment.agentId, agentId))
    .orderBy(agentUserToolAttachment.priority);
}

export async function getUserToolRuns(toolId: string, userId: string) {
  const toolRows = await db.select({ slug: userTool.slug }).from(userTool)
    .where(eq(userTool.id, toolId))
    .limit(1);
  const slug = toolRows[0]?.slug;
  if (!slug) return [];
  return db.select().from(toolRun)
    .where(and(eq(toolRun.userId, userId), eq(toolRun.toolSlug, `user-tool/${slug}`)))
    .orderBy(desc(toolRun.createdAt));
}

export async function getUserToolsByIds(toolIds: string[]) {
  if (toolIds.length === 0) return [];
  return db.select().from(userTool).where(inArray(userTool.id, toolIds));
}

export async function getEffectiveUserToolShareRole(toolId: string, userId: string) {
  const roles = await getEffectiveUserToolShareRoles([toolId], userId);
  return roles.get(toolId) ?? null;
}

export async function getEffectiveUserToolShareRoles(toolIds: string[], userId: string) {
  const uniqueToolIds = [...new Set(toolIds)];
  if (uniqueToolIds.length === 0) {
    return new Map<string, UserToolShareRole>();
  }

  const [directShares, workspaceShares] = await Promise.all([
    db
      .select({ toolId: userToolShare.toolId, role: userToolShare.role })
      .from(userToolShare)
      .where(and(inArray(userToolShare.toolId, uniqueToolIds), eq(userToolShare.sharedWithUserId, userId))),
    db
      .select({ toolId: userToolWorkspaceShare.toolId, role: userToolWorkspaceShare.role })
      .from(userToolWorkspaceShare)
      .innerJoin(workspaceMember, eq(workspaceMember.brandId, userToolWorkspaceShare.brandId))
      .where(and(inArray(userToolWorkspaceShare.toolId, uniqueToolIds), eq(workspaceMember.userId, userId))),
  ]);

  const roleMap = new Map<string, UserToolShareRole>();
  for (const toolId of uniqueToolIds) {
    const role = resolveEffectiveUserToolShareRole(
      ...directShares.filter((share) => share.toolId === toolId).map((share) => share.role),
      ...workspaceShares.filter((share) => share.toolId === toolId).map((share) => share.role),
    );
    if (role) {
      roleMap.set(toolId, role);
    }
  }

  return roleMap;
}
