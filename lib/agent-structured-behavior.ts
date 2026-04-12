import { z } from 'zod';

export const agentStructuredBehaviorSchema = z.object({
  version: z.literal(1).optional(),
  role: z.string().optional().default(''),
  tones: z.array(z.string()).optional().default([]),
  languageRules: z.object({
    replyInThaiWhenUserUsesThai: z.boolean(),
    replyInEnglishWhenUserUsesEnglish: z.boolean(),
    keepRepliesMobileFriendly: z.boolean(),
  }).optional(),
  keyInstructions: z.array(z.string()).optional().default([]),
  context: z.string().optional().default(''),
  exampleReplies: z.string().optional().default(''),
  // Permission policy fields (used by Essential agents and seed script)
  autonomyLevel: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]).optional(),
  toolPermissions: z.record(z.string(), z.enum(['always_allow', 'always_ask'])).optional(),
});

export type AgentStructuredBehavior = z.infer<typeof agentStructuredBehaviorSchema>;

export type ToolPermissionPolicy = 'always_allow' | 'always_ask';

export const createDefaultAgentStructuredBehavior = (): AgentStructuredBehavior => ({
  version: 1,
  role: '',
  tones: [],
  languageRules: {
    replyInThaiWhenUserUsesThai: true,
    replyInEnglishWhenUserUsesEnglish: true,
    keepRepliesMobileFriendly: true,
  },
  keyInstructions: [],
  context: '',
  exampleReplies: '',
});

export const createLegacyCompatibleStructuredBehavior = (): AgentStructuredBehavior => ({
  version: 1,
  role: '',
  tones: [],
  languageRules: {
    replyInThaiWhenUserUsesThai: false,
    replyInEnglishWhenUserUsesEnglish: false,
    keepRepliesMobileFriendly: false,
  },
  keyInstructions: [],
  context: '',
  exampleReplies: '',
});

export const createEssentialAgentBehavior = (
  autonomyLevel: 1 | 2 | 3 | 4 | 5,
  toolPermissions: Record<string, ToolPermissionPolicy> = {},
): AgentStructuredBehavior => ({
  role: '',
  tones: [],
  keyInstructions: [],
  context: '',
  exampleReplies: '',
  autonomyLevel,
  toolPermissions,
});

export const buildStructuredSystemPrompt = ({
  context,
  exampleReplies,
  keyInstructions,
  languageRules,
  role,
  tones,
}: AgentStructuredBehavior) => {
  const sections: string[] = [];

  if (role?.trim()) {
    sections.push(`Role:\n${role.trim()}`);
  }

  if (tones && tones.length > 0) {
    sections.push(`Tone and style:\n- ${tones.join('\n- ')}`);
  }

  if (languageRules) {
    const resolvedLanguageRules = [
      languageRules.replyInThaiWhenUserUsesThai ? 'Reply in Thai when the user writes Thai.' : null,
      languageRules.replyInEnglishWhenUserUsesEnglish ? 'Reply in English when the user writes English.' : null,
      languageRules.keepRepliesMobileFriendly ? 'Keep replies concise and mobile-friendly.' : null,
    ].filter((rule): rule is string => Boolean(rule));

    if (resolvedLanguageRules.length > 0) {
      sections.push(`Language rules:\n- ${resolvedLanguageRules.join('\n- ')}`);
    }
  }

  if (keyInstructions && keyInstructions.length > 0) {
    sections.push(`Key instructions:\n- ${keyInstructions.join('\n- ')}`);
  }

  if (context?.trim()) {
    sections.push(`Business context:\n${context.trim()}`);
  }

  if (exampleReplies?.trim()) {
    sections.push(`Example replies:\n${exampleReplies.trim()}`);
  }

  return sections.join('\n\n');
};
