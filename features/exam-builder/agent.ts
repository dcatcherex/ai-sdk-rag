/**
 * Thin AI SDK adapter for exam-builder tools.
 * All logic lives in service.ts — this file only wires up tool() definitions.
 */

import { tool } from 'ai';
import type { AgentToolContext } from '@/features/tools/registry/types';
import { agentGenerateExamSchema, agentCreateExamSchema, agentExportExamSchema } from './schema';
import { runGenerateExamQuestions, createExamDraft, addQuestionsToExam, getExamDraft, generateExamHtml, generateAnswerKeyHtml } from './service';

export function createExamBuilderAgentTools(
  ctx: Pick<AgentToolContext, 'userId'>,
) {
  const { userId } = ctx;

  return {
    generate_exam_questions: tool({
      description:
        'Generate exam questions for Thai school students aligned to the national curriculum. Supports all question types (MCQ, True/False, Short Answer, Essay, Matching) and Bloom\'s taxonomy levels. Returns structured questions ready to be added to an exam.',
      inputSchema: agentGenerateExamSchema,
      async execute(input) {
        const result = await runGenerateExamQuestions(input);
        return { success: true, ...result };
      },
    }),

    create_exam_draft: tool({
      description:
        'Create and save an exam draft to the database. Optionally include pre-generated questions. Returns the saved exam draft with its ID.',
      inputSchema: agentCreateExamSchema,
      async execute({ questions, ...examInput }) {
        const draft = await createExamDraft(userId, examInput);
        if (questions && questions.length > 0) {
          await addQuestionsToExam(draft.id, userId, questions);
        }
        return { success: true, examId: draft.id, title: draft.title };
      },
    }),

    export_exam_pdf: tool({
      description:
        'Generate a print-ready HTML exam paper and answer key for a saved exam draft. Returns HTML content URLs that teachers can open and print.',
      inputSchema: agentExportExamSchema,
      async execute({ examId, showPoints, includeHeader, answerSheetStyle }) {
        const exam = await getExamDraft(examId, userId);
        if (!exam) return { success: false, error: 'Exam not found' };

        const examHtml = generateExamHtml(exam, { showPoints, includeHeader, answerSheetStyle });
        const answerKeyHtml = generateAnswerKeyHtml(exam);

        return {
          success: true,
          examId,
          title: exam.title,
          questionCount: exam.questions.length,
          totalPoints: exam.totalPoints,
          message: 'Exam HTML generated. The teacher can open the exam link to print it.',
          examHtmlLength: examHtml.length,
          answerKeyHtmlLength: answerKeyHtml.length,
        };
      },
    }),
  };
}
