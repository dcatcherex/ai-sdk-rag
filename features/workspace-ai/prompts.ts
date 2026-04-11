import type {
  WorkspaceImageAssistRequest,
  WorkspaceTextAssistRequest,
} from "./types";

type WorkspacePromptConfig = {
  maxSuggestions: number;
  prompt: string;
  system: string;
};

function formatLocale(locale?: string): string {
  if (!locale) return "Thai";
  if (locale.toLowerCase().startsWith("th")) return "Thai";
  if (locale.toLowerCase().startsWith("en")) return "English";
  return locale;
}

function optionalLine(label: string, value: string | undefined): string {
  return value?.trim() ? `${label}: ${value.trim()}` : "";
}

export function buildWorkspaceTextAssistPrompt(
  input: WorkspaceTextAssistRequest,
): WorkspacePromptConfig {
  const locale = formatLocale(input.targetLocale);
  const tone = input.tone?.trim() || "clear, practical, trustworthy";
  const instruction = input.instruction?.trim();
  const currentValue = input.context.currentValue?.trim();

  switch (input.kind) {
    case "agent-description": {
      return {
        maxSuggestions: 3,
        system: `You write concise product-facing descriptions for AI agents.

Rules:
- Return short UI-ready descriptions, not chat replies.
- Match the requested language.
- Focus on what the agent helps users do.
- Do not mention hidden implementation details unless they matter to the user.
- Each suggestion must be a single sentence.
- Keep each suggestion under 160 characters.
- Return only valid structured output.`,
        prompt: [
          "Write 3 alternative agent descriptions.",
          `Language: ${locale}`,
          `Tone: ${tone}`,
          optionalLine("Agent name", input.context.name),
          optionalLine("System prompt", input.context.systemPrompt),
          optionalLine("Current description", currentValue),
          instruction ? `Extra instruction: ${instruction}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
      };
    }

    case "agent-starters": {
      const existingStarters = Array.isArray(
        input.context.extra?.starterPrompts,
      )
        ? (input.context.extra.starterPrompts as unknown[]).filter(
            (value): value is string => typeof value === "string",
          )
        : [];

      return {
        maxSuggestions: 4,
        system: `You write conversation starter chips for an AI agent onboarding UI.

Rules:
- Return exactly 4 suggestions when possible.
- Each suggestion must sound like something a real user would type.
- Keep each suggestion under 70 characters.
- Use the requested language.
- Make the suggestions varied and specific.
- Do not number the suggestions.
- Do not add quotation marks.
- Return only valid structured output.`,
        prompt: [
          "Write 4 conversation starters for this agent.",
          `Language: ${locale}`,
          `Tone: ${tone}`,
          optionalLine("Agent name", input.context.name),
          optionalLine("System prompt", input.context.systemPrompt),
          existingStarters.length > 0
            ? `Existing starters:\n- ${existingStarters.join("\n- ")}`
            : "",
          instruction ? `Extra instruction: ${instruction}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
      };
    }

    case "skill-description": {
      return {
        maxSuggestions: 3,
        system: `You write concise marketplace-style descriptions for reusable AI skills.

Rules:
- Describe what the skill helps with and when it should be used.
- Keep each suggestion under 180 characters.
- Match the requested language.
- Each suggestion must be a single sentence.
- Return only valid structured output.`,
        prompt: [
          "Write 3 alternative skill descriptions.",
          `Language: ${locale}`,
          `Tone: ${tone}`,
          optionalLine("Skill name", input.context.name),
          optionalLine("Prompt fragment", input.context.promptFragment),
          optionalLine("Current description", currentValue),
          instruction ? `Extra instruction: ${instruction}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
      };
    }
  }
}

export function buildWorkspaceImageAssistPrompt(
  input: WorkspaceImageAssistRequest,
): string {
  switch (input.kind) {
    case "agent-cover": {
      const name = input.context.name?.trim();
      const description = input.context.currentValue?.trim();
      const systemPrompt = input.context.systemPrompt?.trim();
      const instruction = input.instruction?.trim();

      return [
        "Create a polished app cover image for an AI agent profile card.",
        "The image should feel product-ready, visually clear at small thumbnail size, and should not contain readable text, logos, UI chrome, or watermarks.",
        "Prefer a single strong concept with clean composition and a friendly, modern look.",
        name ? `Agent name: ${name}` : "",
        description ? `Agent description: ${description}` : "",
        systemPrompt ? `Agent behavior summary: ${systemPrompt}` : "",
        instruction ? `Extra visual direction: ${instruction}` : "",
      ]
        .filter(Boolean)
        .join("\n");
    }
  }
}
