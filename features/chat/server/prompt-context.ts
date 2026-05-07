import { buildBrandBlock } from '@/features/brands/prompt';
import type { Brand } from '@/features/brands/types';
import type { SkillRuntimeContext } from '@/features/skills/server/activation';

export type PromptSectionType =
  | 'conversation_summary'
  | 'working_memory'
  | 'grounding'
  | 'memory'
  | 'shared_memory'
  | 'domain_context'
  | 'domain_setup'
  | 'brand'
  | 'skills_catalog'
  | 'active_skills'
  | 'skill_resources'
  | 'exam_prep'
  | 'certificate'
  | 'quiz_context'
  | 'brand_resolution'
  | 'extra';

export type PromptSection = {
  type: PromptSectionType;
  /** Raw meaningful content, without leading separators (except for pre-formatted blocks). */
  content: string;
};

export type ResolvedPromptContext = {
  sections: PromptSection[];
  /** Approximate token count for injected sections only (base prompt excluded). chars/4. */
  estimatedInjectionTokens: number;
  systemPrompt: string;
};

export type PromptContextInput = {
  base: string;
  conversationSummaryBlock: string;
  threadWorkingMemoryBlock: string;
  isGrounded: boolean;
  activeBrand: Brand | null;
  memoryContext: string;
  sharedMemoryBlock: string;
  domainContextBlock: string;
  domainSetupBlock: string;
  skillRuntime: Pick<SkillRuntimeContext, 'catalogBlock' | 'activeSkillsBlock' | 'skillResourcesBlock'>;
  examPrepBlock: string;
  certBlock: string;
  quizContextBlock: string;
  brandPromptInstruction?: string | null;
  extraBlocks?: Array<string | null | undefined>;
};

const GROUNDING_INSTRUCTION =
  '\n\nIMPORTANT: The user has selected specific documents. You MUST use the searchKnowledge tool to find information before answering. Only respond using information from tool results. If no relevant information is found, say so.';

/**
 * Renders a single section into its formatted string fragment.
 *
 * Sections that already carry their own leading separator (skill blocks, domain
 * blocks, quiz context, etc.) are returned as-is. Sections whose content is raw
 * prose (memory, working memory, brand) get a leading '\n\n'. The brand_resolution
 * section is wrapped in its XML tag here.
 */
function renderSection(section: PromptSection): string {
  switch (section.type) {
    case 'working_memory':
    case 'memory':
    case 'shared_memory':
    case 'brand':
      return `\n\n${section.content}`;
    case 'brand_resolution':
      return `\n\n<brand_resolution>\n${section.content}\n</brand_resolution>`;
    default:
      // Pre-formatted: conversation_summary, grounding, domain_context, domain_setup,
      // skills_catalog, active_skills, skill_resources, exam_prep, certificate,
      // quiz_context, extra — all carry their own separators.
      return section.content;
  }
}

/**
 * Builds a typed, inspectable representation of the full system prompt.
 *
 * Canonical section order matches assembleSystemPrompt in prompt-assembly.ts:
 *  1  conversation_summary
 *  2  working_memory
 *  3  grounding
 *  4  memory
 *  5  shared_memory
 *  6  domain_context
 *  7  domain_setup
 *  8  brand
 *  9  skills_catalog
 * 10  active_skills
 * 11  skill_resources
 * 12  exam_prep
 * 13  certificate
 * 14  quiz_context
 * 15  brand_resolution
 * 16+ extra
 */
export function buildResolvedPromptContext(input: PromptContextInput): ResolvedPromptContext {
  const sections: PromptSection[] = [];

  if (input.conversationSummaryBlock) {
    sections.push({ type: 'conversation_summary', content: input.conversationSummaryBlock });
  }
  if (input.threadWorkingMemoryBlock) {
    sections.push({ type: 'working_memory', content: input.threadWorkingMemoryBlock });
  }
  if (input.isGrounded) {
    sections.push({ type: 'grounding', content: GROUNDING_INSTRUCTION });
  }
  if (input.memoryContext) {
    sections.push({ type: 'memory', content: input.memoryContext });
  }
  if (input.sharedMemoryBlock) {
    sections.push({ type: 'shared_memory', content: input.sharedMemoryBlock });
  }
  if (input.domainContextBlock) {
    sections.push({ type: 'domain_context', content: input.domainContextBlock });
  }
  if (input.domainSetupBlock) {
    sections.push({ type: 'domain_setup', content: input.domainSetupBlock });
  }
  if (input.activeBrand) {
    const brandContent = buildBrandBlock(input.activeBrand);
    if (brandContent) sections.push({ type: 'brand', content: brandContent });
  }
  if (input.skillRuntime.catalogBlock) {
    sections.push({ type: 'skills_catalog', content: input.skillRuntime.catalogBlock });
  }
  if (input.skillRuntime.activeSkillsBlock) {
    sections.push({ type: 'active_skills', content: input.skillRuntime.activeSkillsBlock });
  }
  if (input.skillRuntime.skillResourcesBlock) {
    sections.push({ type: 'skill_resources', content: input.skillRuntime.skillResourcesBlock });
  }
  if (input.examPrepBlock) {
    sections.push({ type: 'exam_prep', content: input.examPrepBlock });
  }
  if (input.certBlock) {
    sections.push({ type: 'certificate', content: input.certBlock });
  }
  if (input.quizContextBlock) {
    sections.push({ type: 'quiz_context', content: input.quizContextBlock });
  }
  if (input.brandPromptInstruction) {
    sections.push({ type: 'brand_resolution', content: input.brandPromptInstruction });
  }
  const validExtras = (input.extraBlocks ?? []).filter((b): b is string => Boolean(b));
  for (const block of validExtras) {
    sections.push({ type: 'extra', content: block });
  }

  const estimatedInjectionTokens = Math.ceil(
    sections.reduce((sum, s) => sum + s.content.length, 0) / 4,
  );
  const systemPrompt = input.base + sections.map(renderSection).join('');

  return { sections, estimatedInjectionTokens, systemPrompt };
}
