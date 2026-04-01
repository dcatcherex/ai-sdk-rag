import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod/v4';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { agentTeam, agentTeamMember } from '@/db/schema';

type Params = { params: Promise<{ teamId: string; memberId: string }> };

const updateMemberSchema = z.object({
  role: z.enum(['orchestrator', 'specialist']).optional(),
  displayRole: z.string().max(60).optional().nullable(),
  position: z.number().int().min(0).optional(),
  tags: z.array(z.string().max(30)).max(10).optional(),
  handoffInstructions: z.string().max(1000).optional().nullable(),
});

// ── PUT /api/agent-teams/[teamId]/members/[memberId] — update member config ───
export async function PUT(req: Request, { params }: Params) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { teamId, memberId } = await params;

  // Verify team ownership
  const [team] = await db
    .select({ id: agentTeam.id })
    .from(agentTeam)
    .where(and(eq(agentTeam.id, teamId), eq(agentTeam.userId, session.user.id)))
    .limit(1);

  if (!team) return NextResponse.json({ error: 'Team not found' }, { status: 404 });

  const [member] = await db
    .select({ id: agentTeamMember.id, role: agentTeamMember.role })
    .from(agentTeamMember)
    .where(and(eq(agentTeamMember.id, memberId), eq(agentTeamMember.teamId, teamId)))
    .limit(1);

  if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 });

  const body = updateMemberSchema.parse(await req.json());

  // Enforce one orchestrator per team
  if (body.role === 'orchestrator' && member.role !== 'orchestrator') {
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

  const [updated] = await db
    .update(agentTeamMember)
    .set(body)
    .where(and(eq(agentTeamMember.id, memberId), eq(agentTeamMember.teamId, teamId)))
    .returning();

  await db.update(agentTeam).set({ updatedAt: new Date() }).where(eq(agentTeam.id, teamId));

  return NextResponse.json({ member: updated });
}

// ── DELETE /api/agent-teams/[teamId]/members/[memberId] — remove member ───────
export async function DELETE(_req: Request, { params }: Params) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { teamId, memberId } = await params;

  // Verify team ownership
  const [team] = await db
    .select({ id: agentTeam.id })
    .from(agentTeam)
    .where(and(eq(agentTeam.id, teamId), eq(agentTeam.userId, session.user.id)))
    .limit(1);

  if (!team) return NextResponse.json({ error: 'Team not found' }, { status: 404 });

  const [member] = await db
    .select({ id: agentTeamMember.id })
    .from(agentTeamMember)
    .where(and(eq(agentTeamMember.id, memberId), eq(agentTeamMember.teamId, teamId)))
    .limit(1);

  if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 });

  await db.delete(agentTeamMember).where(eq(agentTeamMember.id, memberId));
  await db.update(agentTeam).set({ updatedAt: new Date() }).where(eq(agentTeam.id, teamId));

  return NextResponse.json({ success: true });
}
