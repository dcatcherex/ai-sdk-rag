import type { SkillRuntimeContext } from "@/features/skills/server/activation";

import type { ResolvedDomainContext } from "../types";
import {
  DOMAIN_PROFILE_DEFINITIONS,
  type DomainProfileDefinition,
} from "./definitions";

function scoreDefinitionFromSkills(
  definition: DomainProfileDefinition,
  runtime: SkillRuntimeContext,
): number {
  let score = 0;

  for (const entry of runtime.activatedSkills) {
    const haystack = [
      entry.skill.name,
      entry.skill.description ?? "",
      entry.instructionPath ?? "",
    ]
      .join(" ")
      .toLowerCase();

    for (const hint of definition.skillHints) {
      if (haystack.includes(hint.toLowerCase())) {
        score += hint.length >= 8 ? 4 : 2;
      }
    }
  }

  return score;
}

function scoreDefinitionFromMessage(
  definition: DomainProfileDefinition,
  userMessage: string | null,
): number {
  if (!userMessage?.trim()) {
    return 0;
  }

  return definition.messagePatterns.reduce((sum, pattern) => {
    return pattern.test(userMessage) ? sum + 2 : sum;
  }, 0);
}

function selectSetupDefinition(input: {
  userMessage: string | null;
  skillRuntime: SkillRuntimeContext;
}): DomainProfileDefinition | null {
  let best:
    | { definition: DomainProfileDefinition; score: number }
    | null = null;

  for (const definition of DOMAIN_PROFILE_DEFINITIONS) {
    const score =
      scoreDefinitionFromSkills(definition, input.skillRuntime) +
      scoreDefinitionFromMessage(definition, input.userMessage);

    if (score <= 0) {
      continue;
    }

    if (!best || score > best.score) {
      best = { definition, score };
    }
  }

  return best?.definition ?? null;
}

export function buildDomainSetupPromptBlock(input: {
  userMessage: string | null;
  context: ResolvedDomainContext | null;
  skillRuntime: SkillRuntimeContext;
}): string {
  if (input.context?.profile.domain) {
    return "";
  }

  const definition = selectSetupDefinition(input);
  if (!definition) {
    return "";
  }

  const lines = [
    "<domain_setup_opportunity>",
    `Optional progressive setup is available for ${definition.domain}.`,
    "Only offer this if it helps the current conversation.",
    definition.optionalityNote,
    "Keep the conversation lightweight and ask only one or two missing questions at a time.",
    `Good first fields to capture: ${definition.profileFieldHints.join(", ")}.`,
    "Good entity examples:",
    ...Object.values(definition.entityTypes).map((entity) => `- ${entity.exampleSummary}`),
    definition.setupPrompt,
    "When the user clearly confirms saving persistent data, use create_profile, update_profile, create_entity, or update_entity as appropriate.",
    "</domain_setup_opportunity>",
  ];

  return `\n\n${lines.join("\n")}`;
}
