import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { and, eq, count } from 'drizzle-orm';
import { z } from 'zod/v4';
import { nanoid } from 'nanoid';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { agentTeam, agentTeamMember, agent } from '@/db/schema';

type Params = { params: Promise<{ teamId: string }> };

const addMemberSchema = z.object({
  agentId: z.string().min(1),
  role: z.enum(['orchestrator', 'specialist']).optional(),
  displayRole: z.string().max(60).optional(),
  position: z.number().int().min(0).optional(),
  tags: z.array(z.string().max(30)).max(10).optional(),
  handoffInstructions: z.string().max(1000).optional(),
});

// ── POST /api/agent-teams/[teamId]/members — add a member to a team ──────────
export async function POST(req: Request, { params }: Params) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { teamId } = await params;

  // Verify team ownership
  const [team] = await db
    .select({ id: agentTeam.id })
    .from(agentTeam)
    .where(and(eq(agentTeam.id, teamId), eq(agentTeam.userId, session.user.id)))
    .limit(1);

  if (!team) return NextResponse.json({ error: 'Team not found' }, { status: 404 });

  const body = addMemberSchema.parse(await req.json());

  // Verify agent exists and user has access to it
  const [agentRow] = await db
    .select({ id: agent.id, name: agent.name })
    .from(agent)
    .where(eq(agent.id, body.agentId))
    .limit(1);

  if (!agentRow) return NextResponse.json({ error: 'Agent not found' }, { status: 404 });

  // Enforce one orchestrator per team
  if (body.role === 'orchestrator') {
    const [existing] = await db
      .select({ id: agentTeamMember.id })
      .from(agentTeamMember)
      .where(
        and(
          eq(agentTeamMember.teamId, teamId),
          eq(agentTeamMember.role, 'orchestrator'),
        ),
      )
      .limit(1);

    if (existing) {
      return NextResponse.json(
        { error: 'A team can only have one orchestrator. Remove the existing one first.' },
        { status: 409 },
      );
    }
  }

  // Auto-assign position if not provided (append to end)
  let position = body.position;
  if (position === undefined) {
    const [result] = await db
      .select({ count: count() })
      .from(agentTeamMember)
      .where(eq(agentTeamMember.teamId, teamId));
    position = result?.count ?? 0;
  }

  const newMember = {
    id: nanoid(),
    teamId,
    agentId: body.agentId,
    role: body.role ?? 'specialist',
    displayRole: body.displayRole ?? null,
    position,
    tags: body.tags ?? [],
    handoffInstructions: body.handoffInstructions ?? null,
    createdAt: new Date(),
  };

  await db.insert(agentTeamMember).values(newMember);

  // Update team updatedAt
  await db
    .update(agentTeam)
    .set({ updatedAt: new Date() })
    .where(eq(agentTeam.id, teamId));

  return NextResponse.json({ member: { ...newMember, agentName: agentRow.name } }, { status: 201 });
}
