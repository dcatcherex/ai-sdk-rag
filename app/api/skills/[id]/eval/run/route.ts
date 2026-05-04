import { nanoid } from 'nanoid';
import { and, eq } from 'drizzle-orm';
import { requireUser } from '@/lib/auth-server';
import { db } from '@/lib/db';
import { agentSkill, skillEvalCase, skillEvalRun } from '@/db/schema';
import { mapSkillRow } from '@/features/skills/server/shared';
import { detectTriggeredSkills } from '@/features/skills/server/activation';

type CaseResult = {
  caseId: string;
  message: string;
  label: string | null;
  expected: boolean;
  actual: boolean;
  activationSource: 'rule' | null;
};

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;
  const { id: skillId } = await params;

  const [skillRow] = await db
    .select()
    .from(agentSkill)
    .where(and(eq(agentSkill.id, skillId), eq(agentSkill.userId, authResult.user.id)))
    .limit(1);

  if (!skillRow) return new Response('Not Found', { status: 404 });

  const cases = await db
    .select()
    .from(skillEvalCase)
    .where(eq(skillEvalCase.skillId, skillId));

  if (cases.length === 0) {
    return Response.json({ error: 'No eval cases defined for this skill.' }, { status: 400 });
  }

  const skill = mapSkillRow(skillRow);

  // Run rule-based activation check for each case
  const results: CaseResult[] = cases.map((evalCase) => {
    const triggered = detectTriggeredSkills([skill], evalCase.message);
    const activated = triggered.some((s) => s.id === skillId);
    return {
      caseId: evalCase.id,
      message: evalCase.message,
      label: evalCase.label,
      expected: evalCase.shouldActivate,
      actual: activated,
      activationSource: activated ? 'rule' : null,
    };
  });

  // Compute precision / recall / F1
  const tp = results.filter((r) => r.expected && r.actual).length;
  const fp = results.filter((r) => !r.expected && r.actual).length;
  const fn = results.filter((r) => r.expected && !r.actual).length;

  const precision = tp + fp > 0 ? tp / (tp + fp) : null;
  const recall = tp + fn > 0 ? tp / (tp + fn) : null;
  const f1 = precision !== null && recall !== null && precision + recall > 0
    ? (2 * precision * recall) / (precision + recall)
    : null;

  const [run] = await db
    .insert(skillEvalRun)
    .values({
      id: nanoid(),
      skillId,
      precision,
      recall,
      f1,
      results,
    })
    .returning();

  return Response.json(run, { status: 201 });
}
