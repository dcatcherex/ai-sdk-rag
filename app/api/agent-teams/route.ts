import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { eq, desc, asc } from 'drizzle-orm';
import { z } from 'zod/v4';
import { nanoid } from 'nanoid';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { agentTeam, agentTeamMember, agent } from '@/db/schema';

const createSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
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

// ── GET /api/agent-teams — list user's teams with member counts ───────────────
export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const teams = await db
    .select()
    .from(agentTeam)
    .where(eq(agentTeam.userId, session.user.id))
    .orderBy(desc(agentTeam.updatedAt));

  // Fetch members for all teams in one query
  const teamIds = teams.map((t) => t.id);
  const allMembers =
    teamIds.length > 0
      ? await db
          .select({
            teamId: agentTeamMember.teamId,
            id: agentTeamMember.id,
            agentId: agentTeamMember.agentId,
            role: agentTeamMember.role,
            displayRole: agentTeamMember.displayRole,
            position: agentTeamMember.position,
            tags: agentTeamMember.tags,
            handoffInstructions: agentTeamMember.handoffInstructions,
            createdAt: agentTeamMember.createdAt,
            agentName: agent.name,
            agentDescription: agent.description,
            agentModelId: agent.modelId,
          })
          .from(agentTeamMember)
          .innerJoin(agent, eq(agentTeamMember.agentId, agent.id))
          .where(
            teamIds.length === 1
              ? eq(agentTeamMember.teamId, teamIds[0]!)
              : // Drizzle doesn't have inArray for this, use filter after fetch
                eq(agentTeamMember.teamId, agentTeamMember.teamId),
          )
          .orderBy(asc(agentTeamMember.position))
      : [];

  const memberMap = allMembers
    .filter((m) => teamIds.includes(m.teamId))
    .reduce<Record<string, typeof allMembers>>((acc, m) => {
      (acc[m.teamId] ??= []).push(m);
      return acc;
    }, {});

  const result = teams.map((t) => ({ ...t, members: memberMap[t.id] ?? [] }));

  return NextResponse.json({ teams: result });
}

// ── POST /api/agent-teams — create a new team ─────────────────────────────────
export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = createSchema.parse(await req.json());
  const now = new Date();

  const newTeam = {
    id: nanoid(),
    userId: session.user.id,
    name: body.name,
    description: body.description ?? null,
    routingStrategy: body.routingStrategy ?? 'sequential',
    config: body.config ?? {},
    brandId: body.brandId ?? null,
    isPublic: body.isPublic ?? false,
    createdAt: now,
    updatedAt: now,
  } as const;

  await db.insert(agentTeam).values(newTeam);

  return NextResponse.json({ team: newTeam }, { status: 201 });
}
