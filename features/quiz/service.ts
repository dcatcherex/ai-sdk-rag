/**
 * Canonical quiz/exam-prep business logic.
 * This is the ONLY place these operations are implemented.
 * Agent adapters, API routes, and sidebar all call these functions.
 */

import { generateText, Output } from 'ai';
import { searchDocumentsByIds, type SearchResult } from '@/lib/vector-store';
import {
  type GeneratePracticeQuizInput,
  type GradePracticeAnswerInput,
  type CreateStudyPlanInput,
  type AnalyzeLearningGapsInput,
  type GenerateFlashcardsInput,
  quizOutputSchema,
  gradingOutputSchema,
  studyPlanOutputSchema,
  learningGapOutputSchema,
  flashcardOutputSchema,
} from './schema';

export type QuizServiceOptions = {
  documentIds?: string[];
  rerankEnabled?: boolean;
};

// ── Internal grounding helpers ────────────────────────────────────────────────

const QUIZ_MODEL = 'google/gemini-2.5-flash-lite';
const DEFAULT_GROUNDING_LIMIT = 4;

type GroundingReference = {
  id: number;
  source: string;
  page?: number | null;
  section?: string;
  documentId?: string;
};

type GroundingContext = {
  excerptBlock?: string;
  references: GroundingReference[];
  sources: string[];
};

function formatGroundingResults(results: SearchResult[]): GroundingContext {
  if (results.length === 0) return { references: [], sources: [] };

  const excerptBlock = results
    .map((result, index) => {
      const source =
        result.fileName ?? result.metadata.title ?? result.metadata.source ?? 'Unknown';
      const locationParts = [
        result.page != null ? `p.${result.page}` : null,
        result.section ?? null,
      ].filter((v): v is string => Boolean(v));
      const location = locationParts.length > 0 ? ` (${locationParts.join(', ')})` : '';
      return `[${index + 1}] ${source}${location}\n${result.content}`;
    })
    .join('\n\n---\n\n');

  return {
    excerptBlock,
    references: results.map((result, index) => ({
      id: index + 1,
      source: result.fileName ?? result.metadata.title ?? result.metadata.source ?? 'Unknown',
      page: result.page ?? null,
      section: result.section,
      documentId: result.documentId,
    })),
    sources: Array.from(
      new Set(
        results.map(
          (result) =>
            result.fileName ?? result.metadata.title ?? result.metadata.source ?? 'Unknown',
        ),
      ),
    ),
  };
}

async function getKnowledgeGrounding(
  query: string,
  options?: QuizServiceOptions,
): Promise<GroundingContext> {
  if (!options?.documentIds || options.documentIds.length === 0) {
    return { references: [], sources: [] };
  }
  const results = await searchDocumentsByIds(query, options.documentIds, {
    limit: DEFAULT_GROUNDING_LIMIT,
    rerank: options.rerankEnabled ?? false,
  });
  return formatGroundingResults(results);
}

function getDaysRemaining(examDate: string): number {
  const exam = new Date(examDate);
  if (Number.isNaN(exam.getTime())) return 0;
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.max(0, Math.ceil((exam.getTime() - Date.now()) / msPerDay));
}

// ── Service functions ─────────────────────────────────────────────────────────

export async function runGeneratePracticeQuiz(
  input: GeneratePracticeQuizInput,
  options?: QuizServiceOptions,
) {
  const { topic, difficulty, questionCount, format, examStyle, sourceMaterial } = input;
  const grounding = await getKnowledgeGrounding(
    [topic, examStyle].filter((v): v is string => Boolean(v)).join(' '),
    options,
  );
  const mergedSourceMaterial = [sourceMaterial, grounding.excerptBlock]
    .filter((v): v is string => Boolean(v))
    .join('\n\n');

  const { output } = await generateText({
    model: QUIZ_MODEL,
    system:
      "You create high-quality exam practice content. Return only valid structured data that matches the schema. Make questions clear, fair, and aligned to the requested difficulty. For MCQ questions, provide exactly 4 options. For true/false questions, provide options [\"True\", \"False\"]. If source material is provided, base the quiz on it and avoid inventing unsupported facts. When the source material includes numbered excerpts like [1] or [2], add the matching excerpt numbers to each question's references array. Use only the provided excerpt numbers and leave references empty when support is weak or absent.",
    output: Output.object({ schema: quizOutputSchema }),
    prompt: [
      `Topic: ${topic}`,
      `Difficulty: ${difficulty}`,
      `Question count: ${questionCount}`,
      `Format: ${format}`,
      examStyle ? `Exam style: ${examStyle}` : null,
      mergedSourceMaterial ? `Source material:\n${mergedSourceMaterial}` : null,
    ]
      .filter((v): v is string => Boolean(v))
      .join('\n\n'),
  });

  return {
    ...output,
    groundedFromKnowledgeBase: grounding.sources.length > 0,
    groundingReferences: grounding.references,
    sources: grounding.sources,
  };
}

export async function runGradePracticeAnswer(
  input: GradePracticeAnswerInput,
  options?: QuizServiceOptions,
) {
  const { question, userAnswer, expectedAnswer, rubric, strictness } = input;
  const grounding = await getKnowledgeGrounding(
    [question, expectedAnswer].filter((v): v is string => Boolean(v)).join(' '),
    options,
  );

  const { output } = await generateText({
    model: QUIZ_MODEL,
    system:
      "You are a fair exam grader. Grade the answer against the question, expected answer, rubric, and any provided source material. Return only valid structured data that matches the schema. Keep feedback concise and actionable. If source material is provided, prioritize it over unsupported assumptions. When the source material includes numbered excerpts like [1] or [2], add the matching excerpt numbers to each strengths, missingPoints, and improvements item via the references array. Use only the provided excerpt numbers and leave references empty when support is weak or absent.",
    output: Output.object({ schema: gradingOutputSchema }),
    prompt: [
      `Question: ${question}`,
      `User answer: ${userAnswer}`,
      expectedAnswer ? `Expected answer: ${expectedAnswer}` : null,
      rubric && rubric.length > 0 ? `Rubric:\n- ${rubric.join('\n- ')}` : null,
      `Strictness: ${strictness}`,
      grounding.excerptBlock ? `Source material:\n${grounding.excerptBlock}` : null,
    ]
      .filter((v): v is string => Boolean(v))
      .join('\n\n'),
  });

  return {
    ...output,
    groundedFromKnowledgeBase: grounding.sources.length > 0,
    groundingReferences: grounding.references,
    sources: grounding.sources,
  };
}

export async function runCreateStudyPlan(
  input: CreateStudyPlanInput,
  options?: QuizServiceOptions,
) {
  const { examDate, topics, weakTopics, hoursPerDay, goal } = input;
  const daysRemaining = getDaysRemaining(examDate);
  const grounding = await getKnowledgeGrounding(
    [...topics, ...(weakTopics ?? [])].join(' '),
    options,
  );

  const { output } = await generateText({
    model: QUIZ_MODEL,
    system:
      "You create practical exam study plans. Return only valid structured data that matches the schema. Prioritize weak topics, distribute workload realistically, and keep each day focused. If source material is provided, align the plan to it and emphasize document-backed topics. When the source material includes numbered excerpts like [1] or [2], add the matching excerpt numbers to each task's references array. Use only the provided excerpt numbers and leave references empty when support is weak or absent.",
    output: Output.object({ schema: studyPlanOutputSchema }),
    prompt: [
      `Exam date: ${examDate}`,
      `Days remaining: ${daysRemaining}`,
      `Hours per day: ${hoursPerDay}`,
      `Topics:\n- ${topics.join('\n- ')}`,
      weakTopics && weakTopics.length > 0 ? `Weak topics:\n- ${weakTopics.join('\n- ')}` : null,
      goal ? `Goal: ${goal}` : null,
      grounding.excerptBlock ? `Source material:\n${grounding.excerptBlock}` : null,
    ]
      .filter((v): v is string => Boolean(v))
      .join('\n\n'),
  });

  return {
    ...output,
    daysRemaining,
    groundedFromKnowledgeBase: grounding.sources.length > 0,
    groundingReferences: grounding.references,
    sources: grounding.sources,
  };
}

export async function runAnalyzeLearningGaps(
  input: AnalyzeLearningGapsInput,
  options?: QuizServiceOptions,
) {
  const { topic, studentWork, examStyle, goal } = input;
  const grounding = await getKnowledgeGrounding(
    [topic, examStyle, ...studentWork.map((item) => item.question)]
      .filter((v): v is string => Boolean(v))
      .join(' '),
    options,
  );

  const attemptsBlock = studentWork
    .map((item, index) =>
      [
        `Attempt ${index + 1}`,
        `Question: ${item.question}`,
        `Student answer: ${item.studentAnswer}`,
        item.correctAnswer ? `Correct answer: ${item.correctAnswer}` : null,
        typeof item.score === 'number' && typeof item.maxScore === 'number'
          ? `Score: ${item.score}/${item.maxScore}`
          : null,
        item.feedback ? `Feedback: ${item.feedback}` : null,
      ]
        .filter((v): v is string => Boolean(v))
        .join('\n'),
    )
    .join('\n\n');

  const { output } = await generateText({
    model: QUIZ_MODEL,
    system:
      "You analyze learning gaps for exam preparation. Return only valid structured data that matches the schema. Diagnose the learner's weakest areas, identify likely misconceptions, and recommend the next best revision actions. If source material is provided, anchor the diagnosis to it and avoid unsupported claims. When the source material includes numbered excerpts like [1] or [2], add the matching excerpt numbers to each weak area, misconception, and recommended action via the references array. Use only the provided excerpt numbers and leave references empty when support is weak or absent.",
    output: Output.object({ schema: learningGapOutputSchema }),
    prompt: [
      `Topic: ${topic}`,
      examStyle ? `Exam style: ${examStyle}` : null,
      goal ? `Goal: ${goal}` : null,
      `Student work:\n${attemptsBlock}`,
      grounding.excerptBlock ? `Source material:\n${grounding.excerptBlock}` : null,
    ]
      .filter((v): v is string => Boolean(v))
      .join('\n\n'),
  });

  return {
    ...output,
    groundedFromKnowledgeBase: grounding.sources.length > 0,
    groundingReferences: grounding.references,
    sources: grounding.sources,
  };
}

export async function runGenerateFlashcards(
  input: GenerateFlashcardsInput,
  options?: QuizServiceOptions,
) {
  const { topic, cardCount, examStyle, focusAreas, sourceMaterial } = input;
  const grounding = await getKnowledgeGrounding(
    [topic, examStyle, ...(focusAreas ?? [])].filter((v): v is string => Boolean(v)).join(' '),
    options,
  );
  const mergedSourceMaterial = [sourceMaterial, grounding.excerptBlock]
    .filter((v): v is string => Boolean(v))
    .join('\n\n');

  const { output } = await generateText({
    model: QUIZ_MODEL,
    system:
      "You create concise, high-quality study flashcards. Return only valid structured data that matches the schema. Make the front side a clear recall prompt and the back side a concise but informative answer. If source material is provided, base the flashcards on it and avoid inventing unsupported facts. When the source material includes numbered excerpts like [1] or [2], add the matching excerpt numbers to each flashcard's references array. Use only the provided excerpt numbers and leave references empty when support is weak or absent.",
    output: Output.object({ schema: flashcardOutputSchema }),
    prompt: [
      `Topic: ${topic}`,
      `Card count: ${cardCount}`,
      examStyle ? `Exam style: ${examStyle}` : null,
      focusAreas && focusAreas.length > 0 ? `Focus areas:\n- ${focusAreas.join('\n- ')}` : null,
      mergedSourceMaterial ? `Source material:\n${mergedSourceMaterial}` : null,
    ]
      .filter((v): v is string => Boolean(v))
      .join('\n\n'),
  });

  return {
    ...output,
    groundedFromKnowledgeBase: grounding.sources.length > 0,
    groundingReferences: grounding.references,
    sources: grounding.sources,
  };
}
