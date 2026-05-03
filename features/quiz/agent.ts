/**
 * Thin AI SDK adapter for quiz/exam-prep tools.
 * All logic lives in service.ts — this file only wires up tool() definitions.
 */

import { tool } from 'ai';
import type { AgentToolContext } from '@/features/tools/registry/types';
import {
  generatePracticeQuizInputSchema,
  gradePracticeAnswerInputSchema,
  createStudyPlanInputSchema,
  analyzeLearningGapsInputSchema,
  generateFlashcardsInputSchema,
} from './schema';
import {
  runGeneratePracticeQuiz,
  runGradePracticeAnswer,
  runCreateStudyPlan,
  runAnalyzeLearningGaps,
  runGenerateFlashcards,
} from './service';

export function createQuizAgentTools(ctx: Pick<AgentToolContext, 'documentIds' | 'rerankEnabled'>) {
  const serviceOptions = {
    documentIds: ctx.documentIds,
    rerankEnabled: ctx.rerankEnabled,
  };

  return {
    generate_practice_quiz: tool({
      description:
        'Generate a practice quiz for a topic. Use this when the user wants to be tested, quizzed, or given mock exam questions. When selected documents are available, this tool automatically grounds the quiz in those documents. Never generate quiz questions or mock exam content as plain text — always call this tool.',
      inputSchema: generatePracticeQuizInputSchema,
      async execute(input) {
        return { success: true, ...(await runGeneratePracticeQuiz(input, serviceOptions)) };
      },
    }),

    grade_practice_answer: tool({
      description:
        'Grade a user answer for a practice question. Use this when the user asks to check, score, or improve an answer. When selected documents are available, this tool automatically uses them as grading context. Never score or provide written feedback on an answer as plain text — always call this tool.',
      inputSchema: gradePracticeAnswerInputSchema,
      async execute(input) {
        return { success: true, ...(await runGradePracticeAnswer(input, serviceOptions)) };
      },
    }),

    create_study_plan: tool({
      description:
        'Create a study plan for an upcoming exam. Use this when the user wants a revision schedule, topic prioritization, or a plan based on limited time. When selected documents are available, this tool automatically grounds the plan in those materials. Never write a study plan or schedule as plain text — always call this tool.',
      inputSchema: createStudyPlanInputSchema,
      async execute(input) {
        return { success: true, ...(await runCreateStudyPlan(input, serviceOptions)) };
      },
    }),

    analyze_learning_gaps: tool({
      description:
        "Analyze a learner's weak areas based on their answers, scores, and feedback. Use this when the user wants to understand misconceptions, diagnose weak topics, or decide what to revise next. Never diagnose weak areas or write a learning gap analysis as plain text — always call this tool.",
      inputSchema: analyzeLearningGapsInputSchema,
      async execute(input) {
        return { success: true, ...(await runAnalyzeLearningGaps(input, serviceOptions)) };
      },
    }),

    generate_flashcards: tool({
      description:
        'Generate study flashcards for revision. Use this when the user wants memorization prompts, key-term review cards, or quick recall practice. When selected documents are available, this tool automatically grounds the flashcards in those documents. Never generate flashcard content as plain text — always call this tool.',
      inputSchema: generateFlashcardsInputSchema,
      async execute(input) {
        return { success: true, ...(await runGenerateFlashcards(input, serviceOptions)) };
      },
    }),
  };
}
