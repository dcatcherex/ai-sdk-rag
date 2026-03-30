import { z } from 'zod';

export const agentStructuredBehaviorSchema = z.object({
  version: z.literal(1),
  role: z.string(),
  tones: z.array(z.string()),
  languageRules: z.object({
    replyInThaiWhenUserUsesThai: z.boolean(),
    replyInEnglishWhenUserUsesEnglish: z.boolean(),
    keepRepliesMobileFriendly: z.boolean(),
  }),
  keyInstructions: z.array(z.string()),
  context: z.string(),
  exampleReplies: z.string(),
});

export type AgentStructuredBehavior = z.infer<typeof agentStructuredBehaviorSchema>;

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

export const buildStructuredSystemPrompt = ({
  context,
  exampleReplies,
  keyInstructions,
  languageRules,
  role,
  tones,
}: AgentStructuredBehavior) => {
  const sections: string[] = [];

  if (role.trim()) {
    sections.push(`Role:\n${role.trim()}`);
  }

  if (tones.length > 0) {
    sections.push(`Tone and style:\n- ${tones.join('\n- ')}`);
  }

  const resolvedLanguageRules = [
    languageRules.replyInThaiWhenUserUsesThai ? 'Reply in Thai when the user writes Thai.' : null,
    languageRules.replyInEnglishWhenUserUsesEnglish ? 'Reply in English when the user writes English.' : null,
    languageRules.keepRepliesMobileFriendly ? 'Keep replies concise and mobile-friendly.' : null,
  ].filter((rule): rule is string => Boolean(rule));

  if (resolvedLanguageRules.length > 0) {
    sections.push(`Language rules:\n- ${resolvedLanguageRules.join('\n- ')}`);
  }

  if (keyInstructions.length > 0) {
    sections.push(`Key instructions:\n- ${keyInstructions.join('\n- ')}`);
  }

  if (context.trim()) {
    sections.push(`Business context:\n${context.trim()}`);
  }

  if (exampleReplies.trim()) {
    sections.push(`Example replies:\n${exampleReplies.trim()}`);
  }

  return sections.join('\n\n');
};
