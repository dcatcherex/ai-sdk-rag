import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { and, desc, eq, inArray, isNull, ne, or } from 'drizzle-orm';
import { z } from 'zod';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { agent, agentShare, user as userTable } from '@/db/schema';
import type { SharedUser } from '@/features/agents/types';
import { getResolvedSkillIdsByAgentIds, replaceSkillAttachmentsForAgent } from '@/features/skills/service';
import { agentStructuredBehaviorSchema } from '@/lib/agent-structured-behavior';

const createSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  systemPrompt: z.string().min(1),
  structuredBehavior: agentStructuredBehaviorSchema.optional().nullable(),
  modelId: z.string().optional().nullable(),
  enabledTools: z.array(z.string()).optional(),
  documentIds: z.array(z.string()).optional(),
  skillIds: z.array(z.string()).optional(),
  brandId: z.string().optional().nullable(),
  isPublic: z.boolean().optional(),
  isDefault: z.boolean().optional(),
  starterPrompts: z.array(z.string().max(100)).max(4).optional(),
  sharedUserIds: z.array(z.string()).optional(),
});

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 1. Own agents (excluding templates)
  const ownAgents = await db
    .select()
    .from(agent)
    .where(and(eq(agent.userId, session.user.id), eq(agent.isTemplate, false)))
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
  const ownAgentsOut = ownAgents.map((a) => ({ ...a, sharedWith: shareMap[a.id] ?? [] }));

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
      isPublic: agent.isPublic,
      createdAt: agent.createdAt,
      updatedAt: agent.updatedAt,
      ownerName: userTable.name,
    })
    .from(agent)
    .innerJoin(userTable, eq(agent.userId, userTable.id))
    .where(and(eq(agent.isPublic, true), ne(agent.userId, session.user.id)))
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
      isPublic: agent.isPublic,
      createdAt: agent.createdAt,
      updatedAt: agent.updatedAt,
      ownerName: userTable.name,
    })
    .from(agentShare)
    .innerJoin(agent, eq(agentShare.agentId, agent.id))
    .innerJoin(userTable, eq(agent.userId, userTable.id))
    .where(
      and(
        eq(agentShare.sharedWithUserId, session.user.id),
        ne(agent.userId, session.user.id),
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
    .where(and(isNull(agent.userId), eq(agent.isTemplate, true)))
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
      skillIds: attachmentMap[row.id] ?? row.skillIds,
    }));

  return NextResponse.json({
    agents: [
      ...withResolvedSkillIds(ownAgentsOut),
      ...withResolvedSkillIds(publicAgents),
      ...withResolvedSkillIds(deduped),
    ],
    templates: withResolvedSkillIds(templates),
  });
}

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = createSchema.parse(await req.json());
  const now = new Date();

  const newAgent = {
    id: crypto.randomUUID(),
    userId: session.user.id,
    name: body.name,
    description: body.description ?? null,
    systemPrompt: body.systemPrompt,
    structuredBehavior: body.structuredBehavior ?? null,
    modelId: body.modelId ?? null,
    enabledTools: body.enabledTools ?? [],
    documentIds: body.documentIds ?? [],
    skillIds: body.skillIds ?? [],
    brandId: body.brandId ?? null,
    isPublic: body.isPublic ?? false,
    isDefault: body.isDefault ?? false,
    isTemplate: false,
    templateId: null,
    starterPrompts: body.starterPrompts ?? [],
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(agent).values(newAgent);
  await replaceSkillAttachmentsForAgent(newAgent.id, newAgent.skillIds);

  if (body.sharedUserIds && body.sharedUserIds.length > 0) {
    await db.insert(agentShare).values(
      body.sharedUserIds.map((userId) => ({
        id: crypto.randomUUID(),
        agentId: newAgent.id,
        sharedWithUserId: userId,
      })),
    ).onConflictDoNothing();
  }

  return NextResponse.json({ agent: newAgent }, { status: 201 });
}
