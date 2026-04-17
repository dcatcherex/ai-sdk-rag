import { NextResponse } from 'next/server';
import { and, eq, asc } from 'drizzle-orm';
import { z } from 'zod/v4';

import { requireUser } from "@/lib/auth-server";
import { db } from '@/lib/db';
import { agentTeam, agentTeamMember, agent } from '@/db/schema';

type Params = { params: Promise<{ teamId: string }> };

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional().nullable(),
  routingStrategy: z.enum(['sequential', 'planner_generated']).optional(),
  config: z
    .object({
      maxSteps: z.number().int().min(1).max(10).optional(),
      budgetCredits: z.number().int().min(1).optional(),
      outputFormat: z.enum(['markdown', 'json']).optional(),
    })
    .optional(),
  brandId: z.string().optional().nullable(),
  isPublic: z.boolean().optional(),
});

// ── GET /api/agent-teams/[teamId] — team with full member+agent details ────────
export async function GET(_req: Request, { params }: Params) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const { teamId } = await params;

  const [team] = await db
    .select()
    .from(agentTeam)
    .where(and(eq(agentTeam.id, teamId), eq(agentTeam.userId, authResult.user.id)))
    .limit(1);

  if (!team) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const members = await db
    .select({
      id: agentTeamMember.id,
      teamId: agentTeamMember.teamId,
      agentId: agentTeamMember.agentId,
      role: agentTeamMember.role,
      displayRole: agentTeamMember.displayRole,
      position: agentTeamMember.position,
      tags: agentTeamMember.tags,
      handoffInstructions: agentTeamMember.handoffInstructions,
      createdAt: agentTeamMember.createdAt,
      agent: {
        id: agent.id,
        name: agent.name,
        description: agent.description,
        systemPrompt: agent.systemPrompt,
        modelId: agent.modelId,
        enabledTools: agent.enabledTools,
        documentIds: agent.documentIds,
      },
    })
    .from(agentTeamMember)
    .innerJoin(agent, eq(agentTeamMember.agentId, agent.id))
    .where(eq(agentTeamMember.teamId, teamId))
    .orderBy(asc(agentTeamMember.position));

  return NextResponse.json({ team: { ...team, members } });
}

// ── PUT /api/agent-teams/[teamId] — update team config ────────────────────────
export async function PUT(req: Request, { params }: Params) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const { teamId } = await params;
  const body = updateSchema.parse(await req.json());

  const [existing] = await db
    .select({ id: agentTeam.id })
    .from(agentTeam)
    .where(and(eq(agentTeam.id, teamId), eq(agentTeam.userId, authResult.user.id)))
    .limit(1);

  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const [updated] = await db
    .update(agentTeam)
    .set({ ...body, updatedAt: new Date() })
    .where(and(eq(agentTeam.id, teamId), eq(agentTeam.userId, authResult.user.id)))
    .returning();

  return NextResponse.json({ team: updated });
}

// ── DELETE /api/agent-teams/[teamId] — delete team (cascades to members/runs) ─
export async function DELETE(_req: Request, { params }: Params) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const { teamId } = await params;

  const [existing] = await db
    .select({ id: agentTeam.id })
    .from(agentTeam)
    .where(and(eq(agentTeam.id, teamId), eq(agentTeam.userId, authResult.user.id)))
    .limit(1);

  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await db.delete(agentTeam).where(eq(agentTeam.id, teamId));

  return NextResponse.json({ success: true });
}
