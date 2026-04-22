import { buildBrandBlock } from '@/features/brands/service';
import { resolveEffectiveBrand } from '@/features/agents/server/brand-resolution';
import type { AgentTeamMemberWithAgent } from '@/features/agent-teams/types';

export type TeamMemberBrandContextResult =
  | {
      ok: true;
      members: AgentTeamMemberWithAgent[];
    }
  | {
      ok: false;
      error: string;
    };

export async function applyBrandContextToTeamMembers(params: {
  userId: string;
  activeBrandId?: string | null;
  members: AgentTeamMemberWithAgent[];
}): Promise<TeamMemberBrandContextResult> {
  const resolvedMembers: Array<
    | { error: string }
    | { member: AgentTeamMemberWithAgent }
  > = await Promise.all(
    params.members.map(async (member) => {
      const brandResolution = await resolveEffectiveBrand({
        userId: params.userId,
        activeBrandId: params.activeBrandId ?? null,
        agent: member.agent,
      });

      if (brandResolution.shouldBlock) {
        return {
          error:
            brandResolution.blockMessage
            ?? `Agent "${member.agent.name}" requires an accessible brand before it can run.`,
        };
      }

      const brandBlock = brandResolution.effectiveBrand
        ? `\n\n${buildBrandBlock(brandResolution.effectiveBrand)}`
        : '';
      const promptInstruction = brandResolution.promptInstruction
        ? `\n\n<brand_resolution>\n${brandResolution.promptInstruction}\n</brand_resolution>`
        : '';

      return {
        member: {
          ...member,
          agent: {
            ...member.agent,
            systemPrompt: `${member.agent.systemPrompt}${brandBlock}${promptInstruction}`,
          },
        },
      };
    }),
  );

  const blockingResult = resolvedMembers.find((entry) => 'error' in entry);
  if (blockingResult && 'error' in blockingResult) {
    return {
      ok: false,
      error: blockingResult.error,
    };
  }

  return {
    ok: true,
    members: resolvedMembers.map((entry) => ('member' in entry ? entry.member : null)).filter(Boolean) as AgentTeamMemberWithAgent[],
  };
}
