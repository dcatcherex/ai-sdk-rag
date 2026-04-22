/**
 * POST /api/team-chat/plan
 *
 * Generates and returns the orchestrator execution plan for a planner_generated team
 * WITHOUT executing any specialist steps or deducting credits.
 *
 * Used by the plan-preview UI so users can review/edit sub-prompts before committing.
 *
 * Request body: { teamId: string, userPrompt: string }
 * Response:     PlanPreviewResponse
 */

import { and, eq } from 'drizzle-orm';
import { z } from 'zod/v4';

import { requireUser } from "@/lib/auth-server";
import { db } from '@/lib/db';
import { agentTeam, agentTeamMember, agent } from '@/db/schema';
import { applyBrandContextToTeamMembers } from '@/features/agent-teams/server/brand-context';
import { generatePlan } from '@/features/agent-teams/server/orchestrator';
import type {
  AgentTeamMemberWithAgent,
  PlanPreviewResponse,
} from '@/features/agent-teams/types';

export const maxDuration = 30;

const requestSchema = z.object({
  teamId: z.string().min(1),
  userPrompt: z.string().min(1).max(4000),
});

export async function POST(req: Request) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;
  let body: z.infer<typeof requestSchema>;
  try {
    body = requestSchema.parse(await req.json());
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 });
  }

  // Load team
  const [teamRow] = await db
    .select()
    .from(agentTeam)
    .where(and(eq(agentTeam.id, body.teamId), eq(agentTeam.userId, authResult.user.id)))
    .limit(1);

  if (!teamRow) {
    return Response.json({ error: 'Team not found' }, { status: 404 });
  }

  if (teamRow.routingStrategy !== 'planner_generated') {
    return Response.json({ error: 'Team does not use planner routing' }, { status: 422 });
  }

  // Load members
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

  const membersWithBrandContext = await applyBrandContextToTeamMembers({
    userId: authResult.user.id,
    activeBrandId: teamRow.brandId ?? null,
    members: memberRows as AgentTeamMemberWithAgent[],
  });

  if (!membersWithBrandContext.ok) {
    return Response.json({ error: membersWithBrandContext.error }, { status: 409 });
  }

  const resolvedMembers = membersWithBrandContext.members;

  const orchestrator = resolvedMembers.find((m) => m.role === 'orchestrator') as AgentTeamMemberWithAgent | undefined;
  const specialists = resolvedMembers.filter((m) => m.role === 'specialist') as AgentTeamMemberWithAgent[];

  if (!orchestrator) {
    return Response.json({ error: 'Team has no orchestrator' }, { status: 422 });
  }

  if (specialists.length === 0) {
    return Response.json({ error: 'Team has no specialists' }, { status: 422 });
  }

  try {
    const { plan, wasFallback } = await generatePlan({
      orchestratorMember: orchestrator,
      userPrompt: body.userPrompt,
      specialists,
    });

    const response: PlanPreviewResponse = {
      steps: plan.steps.map((step) => {
        const member = specialists.find((s) => s.id === step.memberId);
        return {
          memberId: step.memberId,
          memberName: member?.agent.name ?? step.memberId,
          displayRole: member?.displayRole ?? null,
          subPrompt: step.subPrompt,
          artifactType: step.artifactType,
          reasoning: step.reasoning,
        };
      }),
      synthesisInstruction: plan.synthesisInstruction,
      fallback: wasFallback,
    };

    return Response.json(response);
  } catch (err) {
    console.error('[team-chat/plan]', err);
    return Response.json({ error: 'Failed to generate plan' }, { status: 500 });
  }
}
