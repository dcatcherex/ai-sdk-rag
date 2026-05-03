import { enhancePrompt } from '@/lib/prompt-enhance';
import { summarizeConversation, SUMMARY_THRESHOLD } from '@/lib/conversation-summary';
import type { Agent } from '@/features/agents/types';
import type { ChatMessage } from '@/features/chat/types';
import type { SkillRuntimeContext } from '@/features/skills/server/activation';

export type WebPreparedChannelContext = {
  memoryContext?: string;
  sharedMemoryBlock?: string;
  threadWorkingMemoryBlock?: string;
  conversationSummaryBlock?: string;
  quizContextBlock?: string;
  extraBlocks?: Array<string | null | undefined>;
  rerankEnabled?: boolean;
  referenceImageUrls?: string[];
  mcpCredentials?: Record<string, string>;
  baseToolIds?: string[] | null;
  agentOverride?: Agent | null;
  baseSystemPromptOverride?: string;
  userScores?: Map<string, number>;
  toolsOverride?: Record<string, unknown>;
  skillRuntimeOverride?: SkillRuntimeContext;
};

export function buildQuizContextBlock(input: {
  quizContext?: {
    messageId: string;
    answeredCount: number;
    questionCount: number;
    correctCount: number;
    objectiveAnsweredCount: number;
    completed: boolean;
    attempts: Array<{
      question: string;
      topic: string;
      type: string;
      userAnswer?: string;
      correctAnswer: string;
      wasRevealed: boolean;
      isCorrect: boolean | null;
    }>;
  } | null;
}): string {
  const quizContext = input.quizContext;
  if (!quizContext) return '';

  return `\n\n<interactive_quiz_context>
Latest quiz state from the client UI:
- Quiz message ID: ${quizContext.messageId}
- Questions completed: ${quizContext.answeredCount}/${quizContext.questionCount}
- Objective questions scored: ${quizContext.correctCount}/${quizContext.objectiveAnsweredCount}
- Quiz completed: ${quizContext.completed ? 'yes' : 'no'}
${quizContext.attempts.length > 0 ? `- Attempts:\n${quizContext.attempts.map((attempt, index) => [
  `${index + 1}. ${attempt.question}`,
  `   Topic: ${attempt.topic}`,
  `   Type: ${attempt.type}`,
  `   User answer: ${attempt.userAnswer || '(blank)'}`,
  `   Correct answer: ${attempt.correctAnswer}`,
  `   Revealed: ${attempt.wasRevealed ? 'yes' : 'no'}`,
  `   Result: ${attempt.isCorrect === null ? 'not auto-graded' : attempt.isCorrect ? 'correct' : 'incorrect'}`,
].join('\n')).join('\n')}` : ''}
</interactive_quiz_context>

IMPORTANT: This quiz context reflects the learner's actual progress in the interactive quiz UI. If the user asks what to do next, what they got wrong, what to review, or asks for a diagnosis after completing the quiz, rely on this context instead of claiming the quiz is unfinished. If the quiz is completed and the user asks for next-step guidance, prefer using analyze_learning_gaps with the completed attempts when exam prep tools are available.`;
}

export async function resolvePromptEnhancement(input: {
  enabled: boolean;
  lastUserPrompt: string | null;
  memoryContext: string;
  messages: ChatMessage[];
}): Promise<{
  enhancedPrompt?: string;
  messagesToSend: ChatMessage[];
}> {
  if (!input.enabled || !input.lastUserPrompt) {
    return { messagesToSend: input.messages };
  }

  const enhanced = await enhancePrompt(input.lastUserPrompt, input.memoryContext);
  if (enhanced === input.lastUserPrompt) {
    return { messagesToSend: input.messages };
  }

  const lastUserIdx = input.messages.map((m) => m.role).lastIndexOf('user');
  if (lastUserIdx === -1) {
    return { enhancedPrompt: enhanced, messagesToSend: input.messages };
  }

  return {
    enhancedPrompt: enhanced,
    messagesToSend: input.messages.map((m, i) =>
      i !== lastUserIdx
        ? m
        : { ...m, parts: m.parts.map((p) => (p.type === 'text' ? { ...p, text: enhanced } : p)) },
    ),
  };
}

export async function resolveConversationSummary(input: {
  messages: ChatMessage[];
}): Promise<{
  conversationSummaryBlock: string;
  messagesToSend: ChatMessage[];
}> {
  if (input.messages.length <= SUMMARY_THRESHOLD) {
    return {
      conversationSummaryBlock: '',
      messagesToSend: input.messages,
    };
  }

  const { summary, trimmedMessages } = await summarizeConversation(input.messages);
  if (!summary) {
    return {
      conversationSummaryBlock: '',
      messagesToSend: input.messages,
    };
  }

  return {
    conversationSummaryBlock: `\n\n<conversation_summary>\nSummary of earlier conversation:\n${summary}\n</conversation_summary>`,
    messagesToSend: trimmedMessages,
  };
}

export function buildWebChannelContext(input: {
  memoryContext: string;
  sharedMemoryBlock: string;
  threadWorkingMemoryBlock: string;
  conversationSummaryBlock: string;
  quizContextBlock: string;
  imageBlocks: [string, string, string];
  rerankEnabled: boolean;
  referenceImageUrls: string[];
  mcpCredentials: Record<string, string>;
  baseToolIds: string[] | null;
  activeAgent: Agent | null;
  baseSystemPromptOverride?: string;
  userScores: Map<string, number>;
  toolsOverride?: Record<string, unknown>;
  skillRuntime: SkillRuntimeContext;
}): WebPreparedChannelContext {
  return {
    memoryContext: input.memoryContext,
    sharedMemoryBlock: input.sharedMemoryBlock,
    threadWorkingMemoryBlock: input.threadWorkingMemoryBlock,
    conversationSummaryBlock: input.conversationSummaryBlock,
    quizContextBlock: input.quizContextBlock,
    extraBlocks: input.imageBlocks,
    rerankEnabled: input.rerankEnabled,
    referenceImageUrls: input.referenceImageUrls,
    mcpCredentials: input.mcpCredentials,
    baseToolIds: input.baseToolIds,
    agentOverride: input.activeAgent,
    baseSystemPromptOverride: input.baseSystemPromptOverride,
    userScores: input.userScores,
    toolsOverride: input.toolsOverride,
    skillRuntimeOverride: input.skillRuntime,
  };
}
