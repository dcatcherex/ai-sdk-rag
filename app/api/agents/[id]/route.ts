import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import { requireUser } from "@/lib/auth-server";
import { db } from '@/lib/db';
import { agent, agentShare } from '@/db/schema';
import type { BrandAccessPolicy, BrandMode, FallbackBehavior } from '@/features/agents/types';
import { getResolvedSkillIdsByAgentIds } from '@/features/skills/service';
import { agentStructuredBehaviorSchema } from '@/lib/agent-structured-behavior';
import {
  brandAccessPolicySchema,
  brandModeSchema,
  fallbackBehaviorSchema,
  normalizeAgentBrandConfig,
} from '@/features/agents/server/brand-config';

const mcpServerSchema = z.object({
  name: z.string().min(1).max(50),
  url: z.string().url(),
  description: z.string().optional(),
  authType: z.enum(['none', 'bearer', 'api_key']).optional(),
  credentialKey: z.string().optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional().nullable(),
  systemPrompt: z.string().min(1).optional(),
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
  starterPrompts: z.array(z.string().max(100)).max(4).optional(),
  sharedUserIds: z.array(z.string()).optional(),
  mcpServers: z.array(mcpServerSchema).optional(),
});

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;
  const { id } = await params;
  const body = updateSchema.parse(await req.json());

  const existing = await db
    .select({ id: agent.id })
    .from(agent)
    .where(and(eq(agent.id, id), eq(agent.userId, authResult.user.id)))
    .limit(1);

  if (existing.length === 0) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const { sharedUserIds, ...agentFields } = body;
  const nextAgentFields = { ...agentFields };

  if (
    body.brandId !== undefined ||
    body.brandMode !== undefined ||
    body.brandAccessPolicy !== undefined ||
    body.requiresBrandForRun !== undefined ||
    body.fallbackBehavior !== undefined
  ) {
    const currentRows = await db
      .select({
        brandId: agent.brandId,
        brandMode: agent.brandMode,
        brandAccessPolicy: agent.brandAccessPolicy,
        requiresBrandForRun: agent.requiresBrandForRun,
        fallbackBehavior: agent.fallbackBehavior,
      })
      .from(agent)
      .where(and(eq(agent.id, id), eq(agent.userId, authResult.user.id)))
      .limit(1);

    const currentAgent = currentRows[0];
    const brandConfig = normalizeAgentBrandConfig({
      brandId: body.brandId ?? currentAgent?.brandId ?? null,
      brandMode: body.brandMode ?? (currentAgent?.brandMode as BrandMode | undefined) ?? null,
      brandAccessPolicy: body.brandAccessPolicy ?? (currentAgent?.brandAccessPolicy as BrandAccessPolicy | undefined) ?? null,
      requiresBrandForRun: body.requiresBrandForRun ?? currentAgent?.requiresBrandForRun ?? null,
      fallbackBehavior: body.fallbackBehavior ?? (currentAgent?.fallbackBehavior as FallbackBehavior | undefined) ?? null,
    });

    Object.assign(nextAgentFields, brandConfig);
  }

  const updated = await db
    .update(agent)
    .set({ ...nextAgentFields, updatedAt: new Date() })
    .where(and(eq(agent.id, id), eq(agent.userId, authResult.user.id)))
    .returning();
  // Replace shares when provided (delete all + re-insert)
  if (sharedUserIds !== undefined) {
    await db.delete(agentShare).where(eq(agentShare.agentId, id));
    if (sharedUserIds.length > 0) {
      await db.insert(agentShare).values(
        sharedUserIds.map((userId) => ({
          id: crypto.randomUUID(),
          agentId: id,
          sharedWithUserId: userId,
        })),
      ).onConflictDoNothing();
    }
  }

  const resolvedSkillIdsByAgentId = await getResolvedSkillIdsByAgentIds([id]);
  return NextResponse.json({
    agent: {
      ...updated[0],
      skillIds: resolvedSkillIdsByAgentId[id] ?? [],
    },
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;
  const { id } = await params;

  const existing = await db
    .select({ id: agent.id })
    .from(agent)
    .where(and(eq(agent.id, id), eq(agent.userId, authResult.user.id)))
    .limit(1);

  if (existing.length === 0) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  await db.delete(agent).where(and(eq(agent.id, id), eq(agent.userId, authResult.user.id)));

  return NextResponse.json({ success: true });
}
