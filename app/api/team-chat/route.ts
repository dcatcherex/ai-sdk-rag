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

import { and, eq, max } from 'drizzle-orm';
import { z } from 'zod/v4';
import { createUIMessageStreamResponse, createUIMessageStream } from 'ai';
import { nanoid } from 'nanoid';

import { requireUser } from "@/lib/auth-server";
import { db } from '@/lib/db';
import { agentTeam, agentTeamMember, agent, chatThread, chatMessage } from '@/db/schema';
import { getUserBalance } from '@/lib/credits';
import { estimateRunCost, executeTeamRun, TeamRunError } from '@/features/agent-teams/server/run-engine';
import { applyBrandContextToTeamMembers } from '@/features/agent-teams/server/brand-context';
import type { AgentTeamWithMembers, AgentTeamMemberWithAgent, TeamRunStatusUpdate } from '@/features/agent-teams/types';
import type { Agent } from '@/features/agents/types';

// Multi-step runs with tool use require more time: ~5 specialist calls × tool round-trips.
// 120s requires Vercel Pro. Revert to 60s on Hobby plan.
export const maxDuration = 120;

const approvedPlanSchema = z.object({
  steps: z.array(
    z.object({
      memberId: z.string(),
      subPrompt: z.string(),
      artifactType: z.string(),
      usesPreviousSteps: z.array(z.string()).optional(),
    }),
  ),
  synthesisInstruction: z.string(),
});

const requestSchema = z.object({
  teamId: z.string().min(1),
  userPrompt: z.string().min(1).max(4000),
  threadId: z.string().optional().nullable(),
  approvedPlan: approvedPlanSchema.optional(),
});

export async function POST(req: Request) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;
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
    .where(and(eq(agentTeam.id, body.teamId), eq(agentTeam.userId, authResult.user.id)))
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
        brandMode: agent.brandMode,
        brandAccessPolicy: agent.brandAccessPolicy,
        requiresBrandForRun: agent.requiresBrandForRun,
        fallbackBehavior: agent.fallbackBehavior,
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

  const membersWithBrandContext = await applyBrandContextToTeamMembers({
    userId: authResult.user.id,
    activeBrandId: teamRow.brandId ?? null,
    members: memberRows as AgentTeamMemberWithAgent[],
  });

  if (!membersWithBrandContext.ok) {
    return Response.json({ error: membersWithBrandContext.error }, { status: 409 });
  }

  const team: AgentTeamWithMembers = {
    ...teamRow,
    members: membersWithBrandContext.members,
  };

  // ── Thread validation (optional — just a reference) ───────────────────────
  if (body.threadId) {
    const [thread] = await db
      .select({ id: chatThread.id })
      .from(chatThread)
      .where(and(eq(chatThread.id, body.threadId), eq(chatThread.userId, authResult.user.id)))
      .limit(1);

    if (!thread) {
      return Response.json({ error: 'Thread not found' }, { status: 404 });
    }
  }

  // ── Credit pre-check ──────────────────────────────────────────────────────
  const estimatedCost = estimateRunCost(team);
  const balance = await getUserBalance(authResult.user.id);
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
  const userId = authResult.user.id;

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
            approvedPlan: body.approvedPlan as Parameters<typeof executeTeamRun>[0]['approvedPlan'],
            onUpdate: (update: TeamRunStatusUpdate) => {
              teamUpdates.push(update);
              // Push latest state to client so UI can re-render step progress
              writer.write({
                type: 'message-metadata',
                messageMetadata: { teamUpdates: [...teamUpdates] },
              });
            },
          });

          // Persist user + assistant messages to the thread (if threadId provided)
          if (body.threadId) {
            try {
              const [{ maxPos }] = await db
                .select({ maxPos: max(chatMessage.position) })
                .from(chatMessage)
                .where(eq(chatMessage.threadId, body.threadId));
              const base = (maxPos ?? -1) + 1;
              const stepCount = teamUpdates.filter((u) => u.type === 'step_complete').length;

              type JsonValue = Parameters<typeof db.insert<typeof chatMessage>>[0] extends never ? never : unknown;
              await db.insert(chatMessage).values([
                {
                  id: nanoid(),
                  threadId: body.threadId,
                  role: 'user',
                  parts: [{ type: 'text', text: body.userPrompt }] as JsonValue,
                  metadata: null,
                  position: base,
                },
                {
                  id: nanoid(),
                  threadId: body.threadId,
                  role: 'assistant',
                  parts: [{ type: 'text', text: finalOutput }] as JsonValue,
                  metadata: {
                    teamRun: {
                      runId: teamUpdates.find((u) => u.type === 'run_complete')?.runId ?? '',
                      teamId: body.teamId,
                      teamName: teamRow.name,
                      stepCount,
                    },
                  },
                  position: base + 1,
                },
              ]);

              // Touch thread updatedAt + preview
              await db
                .update(chatThread)
                .set({ preview: finalOutput.slice(0, 140), updatedAt: new Date() })
                .where(eq(chatThread.id, body.threadId));
            } catch (persistErr) {
              console.error('[team-chat] failed to persist thread messages', persistErr);
            }
          }

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
