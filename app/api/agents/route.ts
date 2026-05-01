import { NextResponse } from 'next/server';
import { and, desc, eq, inArray, isNull, ne, or } from 'drizzle-orm';
import { z } from 'zod';

import { requireUser, getCurrentUser } from "@/lib/auth-server";
import { db } from '@/lib/db';
import { agent, agentShare, user as userTable } from '@/db/schema';
import type { SharedUser } from '@/features/agents/types';
import { getResolvedSkillIdsByAgentIds } from '@/features/skills/service';
import { agentStructuredBehaviorSchema } from '@/lib/agent-structured-behavior';
import {
  brandAccessPolicySchema,
  brandModeSchema,
  fallbackBehaviorSchema,
  normalizeAgentBrandConfig,
} from '@/features/agents/server/brand-config';
import {
  ensureConfiguredStarterAgentForUser,
  getConfiguredGuestStarterAgent,
} from '@/features/agents/server/starter';

const mcpServerSchema = z.object({
  name: z.string().min(1).max(50),
  url: z.string().url(),
  description: z.string().optional(),
  authType: z.enum(['none', 'bearer', 'api_key']).optional(),
  credentialKey: z.string().optional(),
});

const starterTaskSchema = z.object({
  id: z.string().min(1).max(120),
  title: z.string().min(1).max(120),
  description: z.string().min(1).max(240),
  prompt: z.string().min(1).max(2000),
  icon: z.enum(['calendar', 'chart', 'edit', 'mail', 'message', 'refresh', 'search', 'sparkles']),
  priority: z.enum(['primary', 'secondary']),
});

const createSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  systemPrompt: z.string().min(1),
  structuredBehavior: agentStructuredBehaviorSchema.optional().nullable(),
  modelId: z.string().optional().nullable(),
  enabledTools: z.array(z.string()).optional(),
  documentIds: z.array(z.string()).optional(),
  brandId: z.string().optional().nullable(),
  brandMode: brandModeSchema.optional(),
  brandAccessPolicy: brandAccessPolicySchema.optional(),
  requiresBrandForRun: z.boolean().optional(),
  fallbackBehavior: fallbackBehaviorSchema.optional(),
  imageUrl: z.string().url().optional().nullable(),
  isPublic: z.boolean().optional(),
  isDefault: z.boolean().optional(),
  starterTasks: z.array(starterTaskSchema)
    .max(10)
    .refine((tasks) => tasks.filter((task) => task.priority === 'primary').length <= 4, 'No more than 4 primary starter tasks')
    .refine((tasks) => tasks.filter((task) => task.priority === 'secondary').length <= 6, 'No more than 6 secondary starter tasks')
    .optional(),
  sharedUserIds: z.array(z.string()).optional(),
  mcpServers: z.array(mcpServerSchema).optional(),
});

export async function GET() {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    const guestStarterAgent = await getConfiguredGuestStarterAgent();
    const essentials = guestStarterAgent ? [{ ...guestStarterAgent, isDefault: true }] : [];
    return NextResponse.json({
      agents: [],
      templates: essentials,
      mine: [],
      shared: [],
      essentials,
    });
  }

  const authResult = { ok: true as const, user: currentUser };
  await ensureConfiguredStarterAgentForUser(authResult.user.id);

  // 1. Own agents (excluding templates)
  const ownAgents = await db
    .select()
    .from(agent)
    .where(and(eq(agent.userId, authResult.user.id), eq(agent.isTemplate, false)))
    .orderBy(desc(agent.updatedAt));

  // 2. Share lists for own agents
  const ownAgentIds = ownAgents.map((a) => a.id);
  const shares =
    ownAgentIds.length > 0
      ? await db
          .select({
            agentId: agentShare.agentId,
            userId: userTable.id,
            name: userTable.name,
            email: userTable.email,
            image: userTable.image,
          })
          .from(agentShare)
          .innerJoin(userTable, eq(agentShare.sharedWithUserId, userTable.id))
          .where(inArray(agentShare.agentId, ownAgentIds))
      : [];
  const shareMap = shares.reduce<Record<string, SharedUser[]>>((acc, s) => {
    (acc[s.agentId] ??= []).push({ id: s.userId, name: s.name, email: s.email, image: s.image });
    return acc;
  }, {});
  const ownAgentsOut = ownAgents.map((a) => ({
    ...a,
    sharedWith: shareMap[a.id] ?? [],
  }));

  // 3. Public agents from other users
  const publicAgents = await db
    .select({
      id: agent.id,
      userId: agent.userId,
      name: agent.name,
      description: agent.description,
      systemPrompt: agent.systemPrompt,
      structuredBehavior: agent.structuredBehavior,
      modelId: agent.modelId,
      enabledTools: agent.enabledTools,
      documentIds: agent.documentIds,
      skillIds: agent.skillIds,
      brandId: agent.brandId,
      brandMode: agent.brandMode,
      brandAccessPolicy: agent.brandAccessPolicy,
      requiresBrandForRun: agent.requiresBrandForRun,
      fallbackBehavior: agent.fallbackBehavior,
      imageUrl: agent.imageUrl,
      isPublic: agent.isPublic,
      starterTasks: agent.starterTasks,
      isTemplate: agent.isTemplate,
      templateId: agent.templateId,
      isDefault: agent.isDefault,
      catalogScope: agent.catalogScope,
      catalogStatus: agent.catalogStatus,
      managedByAdmin: agent.managedByAdmin,
      cloneBehavior: agent.cloneBehavior,
      updatePolicy: agent.updatePolicy,
      lockedFields: agent.lockedFields,
      version: agent.version,
      sourceTemplateVersion: agent.sourceTemplateVersion,
      publishedAt: agent.publishedAt,
      archivedAt: agent.archivedAt,
      changelog: agent.changelog,
      createdAt: agent.createdAt,
      updatedAt: agent.updatedAt,
      ownerName: userTable.name,
    })
    .from(agent)
    .innerJoin(userTable, eq(agent.userId, userTable.id))
    .where(and(eq(agent.isPublic, true), ne(agent.userId, authResult.user.id)))
    .orderBy(desc(agent.updatedAt));

  // 4. Targeted shares (non-public agents shared specifically with me)
  const targetedShared = await db
    .select({
      id: agent.id,
      userId: agent.userId,
      name: agent.name,
      description: agent.description,
      systemPrompt: agent.systemPrompt,
      structuredBehavior: agent.structuredBehavior,
      modelId: agent.modelId,
      enabledTools: agent.enabledTools,
      documentIds: agent.documentIds,
      skillIds: agent.skillIds,
      brandId: agent.brandId,
      brandMode: agent.brandMode,
      brandAccessPolicy: agent.brandAccessPolicy,
      requiresBrandForRun: agent.requiresBrandForRun,
      fallbackBehavior: agent.fallbackBehavior,
      imageUrl: agent.imageUrl,
      isPublic: agent.isPublic,
      starterTasks: agent.starterTasks,
      isTemplate: agent.isTemplate,
      templateId: agent.templateId,
      isDefault: agent.isDefault,
      catalogScope: agent.catalogScope,
      catalogStatus: agent.catalogStatus,
      managedByAdmin: agent.managedByAdmin,
      cloneBehavior: agent.cloneBehavior,
      updatePolicy: agent.updatePolicy,
      lockedFields: agent.lockedFields,
      version: agent.version,
      sourceTemplateVersion: agent.sourceTemplateVersion,
      publishedAt: agent.publishedAt,
      archivedAt: agent.archivedAt,
      changelog: agent.changelog,
      createdAt: agent.createdAt,
      updatedAt: agent.updatedAt,
      ownerName: userTable.name,
    })
    .from(agentShare)
    .innerJoin(agent, eq(agentShare.agentId, agent.id))
    .innerJoin(userTable, eq(agent.userId, userTable.id))
    .where(
      and(
        eq(agentShare.sharedWithUserId, authResult.user.id),
        ne(agent.userId, authResult.user.id),
      ),
    )
    .orderBy(desc(agent.updatedAt));

  // Deduplicate: if agent is both public AND targeted-shared, only include once
  const publicIds = new Set(publicAgents.map((a) => a.id));
  const deduped = targetedShared.filter((a) => !publicIds.has(a.id));

  // 5. System templates (userId = null, isTemplate = true)
  const templates = await db
    .select()
    .from(agent)
    .where(
      and(
        isNull(agent.userId),
        eq(agent.isTemplate, true),
        eq(agent.managedByAdmin, true),
        eq(agent.catalogStatus, 'published'),
      ),
    )
    .orderBy(agent.name);

  const allAgentIds = [
    ...ownAgents.map((row) => row.id),
    ...publicAgents.map((row) => row.id),
    ...deduped.map((row) => row.id),
    ...templates.map((row) => row.id),
  ];
  const attachmentMap = await getResolvedSkillIdsByAgentIds(allAgentIds);

  const withResolvedSkillIds = <T extends { id: string; skillIds: string[] }>(rows: T[]) =>
    rows.map((row) => ({
      ...row,
      skillIds: attachmentMap[row.id] ?? [],
    }));

  const mine = withResolvedSkillIds(ownAgentsOut);
  const shared = withResolvedSkillIds([...publicAgents, ...deduped]);
  const essentials = withResolvedSkillIds(templates);

  return NextResponse.json({
    agents: [...mine, ...shared],
    templates: essentials,
    mine,
    shared,
    essentials,
  });
}

export async function POST(req: Request) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;
  const body = createSchema.parse(await req.json());
  const now = new Date();
  const brandConfig = normalizeAgentBrandConfig({
    brandId: body.brandId,
    brandMode: body.brandMode,
    brandAccessPolicy: body.brandAccessPolicy,
    requiresBrandForRun: body.requiresBrandForRun,
    fallbackBehavior: body.fallbackBehavior,
  });

  const newAgent = {
    id: crypto.randomUUID(),
    userId: authResult.user.id,
    name: body.name,
    description: body.description ?? null,
    systemPrompt: body.systemPrompt,
    structuredBehavior: body.structuredBehavior ?? null,
    modelId: body.modelId ?? null,
    enabledTools: body.enabledTools ?? [],
    documentIds: body.documentIds ?? [],
    skillIds: [],
    brandId: brandConfig.brandId,
    brandMode: brandConfig.brandMode,
    brandAccessPolicy: brandConfig.brandAccessPolicy,
    requiresBrandForRun: brandConfig.requiresBrandForRun,
    fallbackBehavior: brandConfig.fallbackBehavior,
    imageUrl: body.imageUrl ?? null,
    isPublic: body.isPublic ?? false,
    isDefault: body.isDefault ?? false,
    isTemplate: false,
    templateId: null,
    catalogScope: 'personal',
    catalogStatus: 'draft',
    managedByAdmin: false,
    cloneBehavior: 'editable_copy',
    updatePolicy: 'notify',
    lockedFields: [],
    version: 1,
    sourceTemplateVersion: null,
    publishedAt: null,
    archivedAt: null,
    changelog: null,
    starterTasks: body.starterTasks ?? [],
    mcpServers: body.mcpServers ?? [],
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(agent).values(newAgent);

  if (body.sharedUserIds && body.sharedUserIds.length > 0) {
    await db.insert(agentShare).values(
      body.sharedUserIds.map((userId) => ({
        id: crypto.randomUUID(),
        agentId: newAgent.id,
        sharedWithUserId: userId,
      })),
    ).onConflictDoNothing();
  }

  const resolvedSkillIdsByAgentId = await getResolvedSkillIdsByAgentIds([newAgent.id]);
  return NextResponse.json({ agent: { ...newAgent, skillIds: resolvedSkillIdsByAgentId[newAgent.id] ?? [] } }, { status: 201 });
}
