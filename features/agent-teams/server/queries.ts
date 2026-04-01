import { eq, and, asc, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '@/lib/db';
import {
  agentTeam,
  agentTeamMember,
  teamRun,
  teamRunStep,
  agent,
} from '@/db/schema';
import type {
  AgentTeamWithMembers,
  TeamRunRow,
  TeamRunStepRow,
  TeamRunWithSteps,
  ArtifactType,
  TeamRunStatus,
  TeamRunStepStatus,
} from '../types';

// ── Team queries ──────────────────────────────────────────────────────────────

/**
 * Fetch a team with all members + their agent rows, ordered by position.
 * Returns null if the team does not exist or belongs to a different user.
 */
export async function getTeamWithMembers(
  teamId: string,
  userId: string,
): Promise<AgentTeamWithMembers | null> {
  const teamRow = await db.query.agentTeam.findFirst({
    where: and(eq(agentTeam.id, teamId), eq(agentTeam.userId, userId)),
    with: {
      members: {
        orderBy: [asc(agentTeamMember.position)],
        with: { agent: true },
      },
    },
  });

  if (!teamRow) return null;

  // Cast: Drizzle infers the nested shape but we need our enriched type
  return teamRow as unknown as AgentTeamWithMembers;
}

/**
 * Fetch all teams owned by a user (without member details).
 */
export async function getUserTeams(userId: string) {
  return db
    .select()
    .from(agentTeam)
    .where(eq(agentTeam.userId, userId));
}

// ── Run lifecycle ─────────────────────────────────────────────────────────────

/**
 * Create a new teamRun row with status 'running'.
 * budgetCredits is copied from team.config.budgetCredits at call time.
 */
export async function createTeamRun(params: {
  teamId: string;
  userId: string;
  threadId?: string | null;
  inputPrompt: string;
  budgetCredits?: number | null;
}): Promise<TeamRunRow> {
  const id = nanoid();
  const now = new Date();

  await db.insert(teamRun).values({
    id,
    teamId: params.teamId,
    userId: params.userId,
    threadId: params.threadId ?? null,
    status: 'running',
    inputPrompt: params.inputPrompt,
    budgetCredits: params.budgetCredits ?? null,
    spentCredits: 0,
    createdAt: now,
  });

  const [row] = await db.select().from(teamRun).where(eq(teamRun.id, id));
  return row!;
}

/**
 * Update run status and optional fields on completion or failure.
 */
export async function updateTeamRun(
  runId: string,
  patch: {
    status?: TeamRunStatus;
    finalOutput?: string;
    spentCredits?: number;
    errorMessage?: string;
    completedAt?: Date;
  },
): Promise<void> {
  await db
    .update(teamRun)
    .set({
      ...(patch.status !== undefined && { status: patch.status }),
      ...(patch.finalOutput !== undefined && { finalOutput: patch.finalOutput }),
      ...(patch.spentCredits !== undefined && { spentCredits: patch.spentCredits }),
      ...(patch.errorMessage !== undefined && { errorMessage: patch.errorMessage }),
      ...(patch.completedAt !== undefined && { completedAt: patch.completedAt }),
    })
    .where(eq(teamRun.id, runId));
}

// ── Step lifecycle ────────────────────────────────────────────────────────────

/**
 * Insert a new step row with status 'running'.
 * Call this before invoking the specialist so the UI can show progress.
 */
export async function createTeamRunStep(params: {
  runId: string;
  memberId?: string | null;
  agentId: string;
  agentName: string;
  role: 'orchestrator' | 'specialist';
  stepIndex: number;
  inputPrompt: string;
}): Promise<TeamRunStepRow> {
  const id = nanoid();
  const now = new Date();

  await db.insert(teamRunStep).values({
    id,
    runId: params.runId,
    memberId: params.memberId ?? null,
    agentId: params.agentId,
    agentName: params.agentName,
    role: params.role,
    stepIndex: params.stepIndex,
    inputPrompt: params.inputPrompt,
    artifactType: 'other',
    creditCost: 0,
    status: 'running',
    startedAt: now,
  });

  const [row] = await db.select().from(teamRunStep).where(eq(teamRunStep.id, id));
  return row!;
}

/**
 * Update a step row on completion or failure.
 */
export async function updateTeamRunStep(
  stepId: string,
  patch: {
    status?: TeamRunStepStatus;
    output?: string;
    summary?: string;
    artifactType?: ArtifactType;
    modelId?: string;
    promptTokens?: number;
    completionTokens?: number;
    creditCost?: number;
    errorMessage?: string;
    completedAt?: Date;
  },
): Promise<void> {
  await db
    .update(teamRunStep)
    .set({
      ...(patch.status !== undefined && { status: patch.status }),
      ...(patch.output !== undefined && { output: patch.output }),
      ...(patch.summary !== undefined && { summary: patch.summary }),
      ...(patch.artifactType !== undefined && { artifactType: patch.artifactType }),
      ...(patch.modelId !== undefined && { modelId: patch.modelId }),
      ...(patch.promptTokens !== undefined && { promptTokens: patch.promptTokens }),
      ...(patch.completionTokens !== undefined && { completionTokens: patch.completionTokens }),
      ...(patch.creditCost !== undefined && { creditCost: patch.creditCost }),
      ...(patch.errorMessage !== undefined && { errorMessage: patch.errorMessage }),
      ...(patch.completedAt !== undefined && { completedAt: patch.completedAt }),
    })
    .where(eq(teamRunStep.id, stepId));
}

// ── Run history ───────────────────────────────────────────────────────────────

/**
 * List recent runs for a team, newest first.
 */
export async function listTeamRuns(
  teamId: string,
  userId: string,
  limit = 20,
): Promise<TeamRunRow[]> {
  return db
    .select()
    .from(teamRun)
    .where(and(eq(teamRun.teamId, teamId), eq(teamRun.userId, userId)))
    .orderBy(desc(teamRun.createdAt))
    .limit(limit);
}

/**
 * Fetch a completed run with all its steps ordered by stepIndex.
 */
export async function getTeamRunWithSteps(
  runId: string,
  userId: string,
): Promise<TeamRunWithSteps | null> {
  const run = await db.query.teamRun.findFirst({
    where: and(eq(teamRun.id, runId), eq(teamRun.userId, userId)),
    with: {
      steps: { orderBy: [asc(teamRunStep.stepIndex)] },
    },
  });

  if (!run) return null;
  return run as unknown as TeamRunWithSteps;
}
