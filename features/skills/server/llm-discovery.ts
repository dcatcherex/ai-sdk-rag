import { generateObject } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod/v4';
import type { Skill } from '../types';

const openrouter = createOpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENAI_API_KEY!,
});

const discoveryModel = openrouter('google/gemini-2.5-flash-lite');

const discoveryResultSchema = z.object({
  skillIds: z.array(z.string()),
});

const DISCOVERY_TIMEOUT_MS = 3000;

export async function runLlmSkillDiscovery(
  catalogSkills: Skill[],
  userMessage: string,
): Promise<Skill[]> {
  if (catalogSkills.length === 0 || !userMessage.trim()) return [];

  const catalog = catalogSkills
    .map((s) => `ID: ${s.id}\nName: ${s.name}\nDescription: ${s.description ?? s.name}`)
    .join('\n\n');

  const discoveryPromise = generateObject({
    model: discoveryModel,
    schema: discoveryResultSchema,
    prompt: [
      'You are a skill router. Return the IDs of skills relevant to the user message.',
      'Return [] if no skill is relevant. Only use IDs from the list. Never invent IDs. Max 3 IDs.',
      '',
      `User message: "${userMessage}"`,
      '',
      'Available skills:',
      catalog,
    ].join('\n'),
  });

  const timeoutPromise = new Promise<null>((resolve) =>
    setTimeout(() => resolve(null), DISCOVERY_TIMEOUT_MS),
  );

  let skillIds: string[];
  try {
    const winner = await Promise.race([discoveryPromise, timeoutPromise]);
    if (winner === null) return [];
    skillIds = winner.object.skillIds;
  } catch {
    return [];
  }

  const validIds = new Set(catalogSkills.map((s) => s.id));
  const activatedIds = skillIds.filter((id) => validIds.has(id)).slice(0, 3);
  return catalogSkills.filter((s) => activatedIds.includes(s.id));
}
