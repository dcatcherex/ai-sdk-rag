import { buildBrandBlock } from '@/features/brands/service';
import type { Brand } from '@/features/brands/types';

export type SystemPromptInput = {
  /** Base system prompt (agent | default). No leading newline. */
  base: string;
  /** Compacted summary of earlier turns. Already '\n\n<conversation_summary>...' or ''. */
  conversationSummaryBlock: string;
  /** Persisted working memory for the current thread. Raw block or ''. */
  threadWorkingMemoryBlock: string;
  /** Whether RAG documents are selected for this request. */
  isGrounded: boolean;
  /** Active brand for this request, or null. */
  activeBrand: Brand | null;
  /** User profile memory from getUserMemoryContext(). Raw block or ''. */
  memoryContext: string;
  /** Approved shared scoped memory block for the active scope. Raw block or ''. */
  sharedMemoryBlock: string;
  /** Skill runtime blocks - each is already '\n\n<tag>...' or ''. */
  skillRuntime: {
    catalogBlock: string;
    activeSkillsBlock: string;
    skillResourcesBlock: string;
  };
  /** Brand profile tool guidance. Already '\nIMPORTANT:...' or '' (gated by caller). */
  brandProfileBlock: string;
  /** Exam prep tool guidance. Already '\nIMPORTANT:...' or '' (gated by caller). */
  examPrepBlock: string;
  /** Certificate tool guidance. Already '\nIMPORTANT:...' or '' (gated by caller). */
  certBlock: string;
  /** Interactive quiz state. Already '\n\n<interactive_quiz_context>...' or ''. */
  quizContextBlock: string;
};

const GROUNDING_INSTRUCTION =
  '\n\nIMPORTANT: The user has selected specific documents. You MUST use the searchKnowledge tool to find information before answering. Only respond using information from tool results. If no relevant information is found, say so.';

/**
 * Assembles the final effective system prompt from typed blocks in a consistent order.
 *
 * Order:
 *   1  Base system prompt
 *   2  Conversation summary (summary of earlier turns)
 *   3  Persisted thread working memory
 *   4  Grounding instruction (when RAG docs are selected)
 *   5  User profile memory
 *   6  Approved shared scoped memory
 *   7  Brand context
 *   8  Skill catalog
 *   9  Active skills
 *  10  Skill resources
 *  11  Tool guidance (exam prep, certificate)
 *  12  Narrow feature blocks (quiz context)
 *
 * Every non-base block is either '' or already carries its own leading '\n\n' / '\n'
 * separator, so no extra spacing is applied here.
 */
export function assembleSystemPrompt(input: SystemPromptInput): string {
  const groundingBlock = input.isGrounded ? GROUNDING_INSTRUCTION : '';
  const threadWorkingMemoryBlock = input.threadWorkingMemoryBlock
    ? `\n\n${input.threadWorkingMemoryBlock}`
    : '';
  const memoryBlock = input.memoryContext ? `\n\n${input.memoryContext}` : '';
  const sharedMemoryBlock = input.sharedMemoryBlock ? `\n\n${input.sharedMemoryBlock}` : '';
  const brandBlock = input.activeBrand
    ? `\n\n${buildBrandBlock(input.activeBrand)}`
    : '';

  return (
    input.base
    + input.conversationSummaryBlock
    + threadWorkingMemoryBlock
    + groundingBlock
    + memoryBlock
    + sharedMemoryBlock
    + brandBlock
    + input.skillRuntime.catalogBlock
    + input.skillRuntime.activeSkillsBlock
    + input.skillRuntime.skillResourcesBlock
    + input.brandProfileBlock
    + input.examPrepBlock
    + input.certBlock
    + input.quizContextBlock
  );
}
