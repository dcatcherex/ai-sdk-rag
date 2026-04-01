/**
 * POST /api/team-chat
 *
 * Supervised multi-agent team chat endpoint.
 * Runs specialists sequentially, streams step-progress updates as data parts,
 * then streams the final synthesised answer as text.
 *
 * Request body:
 *   { teamId: string, userPrompt: string, threadId?: string }
 *
 * Stream parts emitted:
 *   { type: 'data', data: [{ teamUpdate: TeamRunStatusUpdate }] }  — step progress
 *   { type: 'text', text: string }                                 — final answer
 */

import { headers } from 'next/headers';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod/v4';
import { createUIMessageStreamResponse, createUIMessageStream } from 'ai';
import { nanoid } from 'nanoid';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { agentTeam, agentTeamMember, agent, chatThread } from '@/db/schema';
import { getUserBalance } from '@/lib/credits';
import { estimateRunCost, executeTeamRun, TeamRunError } from '@/features/agent-teams/server/run-engine';
import type { AgentTeamWithMembers, AgentTeamMemberWithAgent, TeamRunStatusUpdate } from '@/features/agent-teams/types';
import type { Agent } from '@/features/agents/types';

// Multi-step runs can take longer than a single chat turn.
// Set to 60s — covers up to ~5 specialist calls at ~10s each.
export const maxDuration = 60;

const requestSchema = z.object({
  teamId: z.string().min(1),
  userPrompt: z.string().min(1).max(4000),
  threadId: z.string().optional().nullable(),
});

export async function POST(req: Request) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── Parse + validate request ──────────────────────────────────────────────
  let body: z.infer<typeof requestSchema>;
  try {
    body = requestSchema.parse(await req.json());
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 });
  }

  // ── Load team with members ────────────────────────────────────────────────
  const [teamRow] = await db
    .select()
    .from(agentTeam)
    .where(and(eq(agentTeam.id, body.teamId), eq(agentTeam.userId, session.user.id)))
    .limit(1);

  if (!teamRow) {
    return Response.json({ error: 'Team not found' }, { status: 404 });
  }

  const memberRows = await db
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
        isPublic: agent.isPublic,
        starterPrompts: agent.starterPrompts,
        isTemplate: agent.isTemplate,
        templateId: agent.templateId,
        isDefault: agent.isDefault,
        createdAt: agent.createdAt,
        updatedAt: agent.updatedAt,
      },
    })
    .from(agentTeamMember)
    .innerJoin(agent, eq(agentTeamMember.agentId, agent.id))
    .where(eq(agentTeamMember.teamId, body.teamId))
    .orderBy(agentTeamMember.position);

  if (memberRows.length === 0) {
    return Response.json({ error: 'Team has no members configured' }, { status: 422 });
  }

  const hasOrchestrator = memberRows.some((m) => m.role === 'orchestrator');
  if (!hasOrchestrator) {
    return Response.json({ error: 'Team has no orchestrator member' }, { status: 422 });
  }

  const team: AgentTeamWithMembers = {
    ...teamRow,
    members: memberRows as AgentTeamMemberWithAgent[],
  };

  // ── Thread validation (optional — just a reference) ───────────────────────
  if (body.threadId) {
    const [thread] = await db
      .select({ id: chatThread.id })
      .from(chatThread)
      .where(and(eq(chatThread.id, body.threadId), eq(chatThread.userId, session.user.id)))
      .limit(1);

    if (!thread) {
      return Response.json({ error: 'Thread not found' }, { status: 404 });
    }
  }

  // ── Credit pre-check ──────────────────────────────────────────────────────
  const estimatedCost = estimateRunCost(team);
  const balance = await getUserBalance(session.user.id);
  if (balance < estimatedCost) {
    return Response.json(
      {
        error: `Insufficient credits. Estimated cost: ${estimatedCost} credits, balance: ${balance}.`,
        estimatedCost,
        balance,
      },
      { status: 402 },
    );
  }

  // ── Stream the run ────────────────────────────────────────────────────────
  const userId = session.user.id;

  return createUIMessageStreamResponse({
    stream: createUIMessageStream({
      execute: async ({ writer }) => {
        // Accumulate step updates in metadata so the client can track progress
        // via message.metadata.teamUpdates (read by use-team-chat hook in Phase 4)
        const teamUpdates: TeamRunStatusUpdate[] = [];

        try {
          const { finalOutput } = await executeTeamRun({
            team,
            userId,
            userPrompt: body.userPrompt,
            threadId: body.threadId ?? null,
            onUpdate: (update: TeamRunStatusUpdate) => {
              teamUpdates.push(update);
              // Push latest state to client so UI can re-render step progress
              writer.write({
                type: 'message-metadata',
                messageMetadata: { teamUpdates: [...teamUpdates] },
              });
            },
          });

          // Stream the final synthesised answer as text
          const textId = nanoid();
          writer.write({ type: 'text-start', id: textId });
          writer.write({ type: 'text-delta', delta: finalOutput, id: textId });
          writer.write({ type: 'text-end', id: textId });
        } catch (err) {
          const errorText =
            err instanceof TeamRunError
              ? err.message
              : 'An error occurred while running the team.';
          console.error('[team-chat]', err);
          writer.write({ type: 'error', errorText });
        }
      },
    }),
  });
}
