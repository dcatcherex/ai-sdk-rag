import { generateText, Output, tool } from 'ai';
import { z } from 'zod';
import { searchDocumentsByIds, type SearchResult } from '@/lib/vector-store';

const EXAM_PREP_MODEL = 'google/gemini-2.5-flash-lite';
const DEFAULT_GROUNDING_LIMIT = 4;

const referenceIdsSchema = z.array(z.number().int().min(1)).default([]);

const referencedTextSchema = z.object({
  text: z.string(),
  references: referenceIdsSchema,
});

const quizQuestionSchema = z.object({
  id: z.string(),
  type: z.enum(['mcq', 'short_answer', 'true_false']),
  question: z.string(),
  options: z.array(z.string()).optional(),
  answer: z.string(),
  explanation: z.string(),
  topic: z.string(),
  references: referenceIdsSchema,
});

const quizOutputSchema = z.object({
  instructions: z.string(),
  quiz: z.array(quizQuestionSchema),
});

const gradingOutputSchema = z.object({
  score: z.number().min(0).max(10),
  maxScore: z.number().min(1).max(10),
  verdict: z.string(),
  strengths: z.array(referencedTextSchema),
  missingPoints: z.array(referencedTextSchema),
  improvements: z.array(referencedTextSchema),
  modelAnswer: z.string(),
});

const studyPlanDaySchema = z.object({
  day: z.string(),
  focus: z.string(),
  tasks: z.array(referencedTextSchema),
  estimatedHours: z.number().min(0.5).max(24),
});

const studyPlanOutputSchema = z.object({
  daysRemaining: z.number().int().min(0),
  priorityTopics: z.array(z.string()),
  plan: z.array(studyPlanDaySchema),
});

const learningGapItemSchema = z.object({
  topic: z.string(),
  issue: z.string(),
  severity: z.enum(['high', 'medium', 'low']),
  references: referenceIdsSchema,
});

const learningGapOutputSchema = z.object({
  overallAssessment: z.string(),
  weakAreas: z.array(learningGapItemSchema),
  misconceptions: z.array(referencedTextSchema),
  recommendedActions: z.array(referencedTextSchema),
  nextStudyFocus: z.array(z.string()),
});

const flashcardSchema = z.object({
  id: z.string(),
  front: z.string(),
  back: z.string(),
  topic: z.string(),
  references: referenceIdsSchema,
});

const flashcardOutputSchema = z.object({
  deckTitle: z.string(),
  studyTip: z.string(),
  flashcards: z.array(flashcardSchema),
});

type ExamPrepToolOptions = {
  documentIds?: string[];
  rerankEnabled?: boolean;
};

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

function getDaysRemaining(examDate: string): number {
  const exam = new Date(examDate);
  if (Number.isNaN(exam.getTime())) {
    return 0;
  }

  const now = new Date();
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.max(0, Math.ceil((exam.getTime() - now.getTime()) / msPerDay));
}

function formatGroundingResults(results: SearchResult[]): GroundingContext {
  if (results.length === 0) {
    return {
      references: [],
      sources: [],
    };
  }

  const excerptBlock = results
    .map((result, index) => {
      const source = result.fileName ?? result.metadata.title ?? result.metadata.source ?? 'Unknown';
      const locationParts = [
        result.page != null ? `p.${result.page}` : null,
        result.section ? result.section : null,
      ].filter((value): value is string => Boolean(value));
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
    sources: Array.from(new Set(
      results.map((result) => result.fileName ?? result.metadata.title ?? result.metadata.source ?? 'Unknown')
    )),
  };
}

async function getKnowledgeGrounding(
  query: string,
  options?: ExamPrepToolOptions,
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

export function createExamPrepTools(options?: ExamPrepToolOptions) {
  return {
    generate_practice_quiz: tool({
      description:
        'Generate a practice quiz for a topic. Use this when the user wants to be tested, quizzed, or given mock exam questions. When selected documents are available, this tool automatically grounds the quiz in those documents.',
      inputSchema: z.object({
        topic: z.string().min(1).describe('The subject or topic to generate questions about'),
        difficulty: z.enum(['easy', 'medium', 'hard']).optional().default('medium').describe('Desired difficulty'),
        questionCount: z.number().int().min(1).max(10).optional().default(5).describe('Number of questions to generate'),
        format: z.enum(['mcq', 'short_answer', 'true_false', 'mixed']).optional().default('mixed').describe('Question format'),
        examStyle: z.string().optional().describe('Optional exam style or curriculum, e.g. IELTS, SAT, biology midterm'),
        sourceMaterial: z.string().optional().describe('Optional study notes or knowledge-base excerpts to ground the quiz'),
      }),
      async execute({ topic, difficulty, questionCount, format, examStyle, sourceMaterial }) {
        const grounding = await getKnowledgeGrounding(
          [topic, examStyle].filter((value): value is string => Boolean(value)).join(' '),
          options,
        );
        const mergedSourceMaterial = [sourceMaterial, grounding.excerptBlock]
          .filter((value): value is string => Boolean(value))
          .join('\n\n');
        const { output } = await generateText({
          model: EXAM_PREP_MODEL,
          system: 'You create high-quality exam practice content. Return only valid structured data that matches the schema. Make questions clear, fair, and aligned to the requested difficulty. For MCQ questions, provide exactly 4 options. For true/false questions, provide options ["True", "False"]. If source material is provided, base the quiz on it and avoid inventing unsupported facts. When the source material includes numbered excerpts like [1] or [2], add the matching excerpt numbers to each question\'s references array. Use only the provided excerpt numbers and leave references empty when support is weak or absent.',
          output: Output.object({ schema: quizOutputSchema }),
          prompt: [
            `Topic: ${topic}`,
            `Difficulty: ${difficulty}`,
            `Question count: ${questionCount}`,
            `Format: ${format}`,
            examStyle ? `Exam style: ${examStyle}` : null,
            mergedSourceMaterial ? `Source material:\n${mergedSourceMaterial}` : null,
          ].filter((value): value is string => Boolean(value)).join('\n\n'),
        });

        return {
          success: true,
          ...output,
          groundedFromKnowledgeBase: grounding.sources.length > 0,
          groundingReferences: grounding.references,
          sources: grounding.sources,
        };
      },
    }),

    grade_practice_answer: tool({
      description:
        'Grade a user answer for a practice question. Use this when the user asks to check, score, or improve an answer. When selected documents are available, this tool automatically uses them as grading context.',
      inputSchema: z.object({
        question: z.string().min(1).describe('The original question'),
        userAnswer: z.string().min(1).describe('The answer written by the user'),
        expectedAnswer: z.string().optional().describe('Optional reference answer or answer key'),
        rubric: z.array(z.string()).optional().describe('Optional marking criteria or required points'),
        strictness: z.enum(['lenient', 'balanced', 'strict']).optional().default('balanced').describe('How harshly to grade the answer'),
      }),
      async execute({ question, userAnswer, expectedAnswer, rubric, strictness }) {
        const grounding = await getKnowledgeGrounding(
          [question, expectedAnswer].filter((value): value is string => Boolean(value)).join(' '),
          options,
        );
        const { output } = await generateText({
          model: EXAM_PREP_MODEL,
          system: 'You are a fair exam grader. Grade the answer against the question, expected answer, rubric, and any provided source material. Return only valid structured data that matches the schema. Keep feedback concise and actionable. If source material is provided, prioritize it over unsupported assumptions. When the source material includes numbered excerpts like [1] or [2], add the matching excerpt numbers to each strengths, missingPoints, and improvements item via the references array. Use only the provided excerpt numbers and leave references empty when support is weak or absent.',
          output: Output.object({ schema: gradingOutputSchema }),
          prompt: [
            `Question: ${question}`,
            `User answer: ${userAnswer}`,
            expectedAnswer ? `Expected answer: ${expectedAnswer}` : null,
            rubric && rubric.length > 0 ? `Rubric:\n- ${rubric.join('\n- ')}` : null,
            `Strictness: ${strictness}`,
            grounding.excerptBlock ? `Source material:\n${grounding.excerptBlock}` : null,
          ].filter((value): value is string => Boolean(value)).join('\n\n'),
        });

        return {
          success: true,
          ...output,
          groundedFromKnowledgeBase: grounding.sources.length > 0,
          groundingReferences: grounding.references,
          sources: grounding.sources,
        };
      },
    }),

    create_study_plan: tool({
      description:
        'Create a study plan for an upcoming exam. Use this when the user wants a revision schedule, topic prioritization, or a plan based on limited time. When selected documents are available, this tool automatically grounds the plan in those materials.',
      inputSchema: z.object({
        examDate: z.string().min(1).describe('The exam date in a parseable date format'),
        topics: z.array(z.string()).min(1).describe('Topics that may appear on the exam'),
        weakTopics: z.array(z.string()).optional().describe('Topics the user finds difficult'),
        hoursPerDay: z.number().min(0.5).max(24).optional().default(2).describe('Available study time per day'),
        goal: z.string().optional().describe('Optional goal such as pass, top score, or confidence building'),
      }),
      async execute({ examDate, topics, weakTopics, hoursPerDay, goal }) {
        const daysRemaining = getDaysRemaining(examDate);
        const grounding = await getKnowledgeGrounding(
          [...topics, ...(weakTopics ?? [])].join(' '),
          options,
        );
        const { output } = await generateText({
          model: EXAM_PREP_MODEL,
          system: 'You create practical exam study plans. Return only valid structured data that matches the schema. Prioritize weak topics, distribute workload realistically, and keep each day focused. If source material is provided, align the plan to it and emphasize document-backed topics. When the source material includes numbered excerpts like [1] or [2], add the matching excerpt numbers to each task\'s references array. Use only the provided excerpt numbers and leave references empty when support is weak or absent.',
          output: Output.object({ schema: studyPlanOutputSchema }),
          prompt: [
            `Exam date: ${examDate}`,
            `Days remaining: ${daysRemaining}`,
            `Hours per day: ${hoursPerDay}`,
            `Topics:\n- ${topics.join('\n- ')}`,
            weakTopics && weakTopics.length > 0 ? `Weak topics:\n- ${weakTopics.join('\n- ')}` : null,
            goal ? `Goal: ${goal}` : null,
            grounding.excerptBlock ? `Source material:\n${grounding.excerptBlock}` : null,
          ].filter((value): value is string => Boolean(value)).join('\n\n'),
        });

        return {
          success: true,
          ...output,
          daysRemaining,
          groundedFromKnowledgeBase: grounding.sources.length > 0,
          groundingReferences: grounding.references,
          sources: grounding.sources,
        };
      },
    }),

    analyze_learning_gaps: tool({
      description:
        'Analyze a learner\'s weak areas based on their answers, scores, and feedback. Use this when the user wants to understand misconceptions, diagnose weak topics, or decide what to revise next. When selected documents are available, this tool automatically grounds the diagnosis in those materials.',
      inputSchema: z.object({
        topic: z.string().min(1).describe('The overall subject or exam topic being studied'),
        studentWork: z.array(z.object({
          question: z.string().min(1).describe('The question the learner attempted'),
          studentAnswer: z.string().min(1).describe('The learner\'s answer'),
          correctAnswer: z.string().optional().describe('Optional model or expected answer'),
          score: z.number().min(0).max(100).optional().describe('Optional numeric score for this attempt'),
          maxScore: z.number().min(1).max(100).optional().describe('Optional maximum score for this attempt'),
          feedback: z.string().optional().describe('Optional teacher or grader feedback'),
        })).min(1).describe('One or more answered questions to analyze'),
        examStyle: z.string().optional().describe('Optional exam style or curriculum, e.g. SAT math or biology final'),
        goal: z.string().optional().describe('Optional target outcome such as pass confidently or improve weak areas quickly'),
      }),
      async execute({ topic, studentWork, examStyle, goal }) {
        const grounding = await getKnowledgeGrounding(
          [topic, examStyle, ...studentWork.map((item) => item.question)].filter((value): value is string => Boolean(value)).join(' '),
          options,
        );

        const attemptsBlock = studentWork
          .map((item, index) => [
            `Attempt ${index + 1}`,
            `Question: ${item.question}`,
            `Student answer: ${item.studentAnswer}`,
            item.correctAnswer ? `Correct answer: ${item.correctAnswer}` : null,
            typeof item.score === 'number' && typeof item.maxScore === 'number'
              ? `Score: ${item.score}/${item.maxScore}`
              : null,
            item.feedback ? `Feedback: ${item.feedback}` : null,
          ].filter((value): value is string => Boolean(value)).join('\n'))
          .join('\n\n');

        const { output } = await generateText({
          model: EXAM_PREP_MODEL,
          system: 'You analyze learning gaps for exam preparation. Return only valid structured data that matches the schema. Diagnose the learner\'s weakest areas, identify likely misconceptions, and recommend the next best revision actions. If source material is provided, anchor the diagnosis to it and avoid unsupported claims. When the source material includes numbered excerpts like [1] or [2], add the matching excerpt numbers to each weak area, misconception, and recommended action via the references array. Use only the provided excerpt numbers and leave references empty when support is weak or absent.',
          output: Output.object({ schema: learningGapOutputSchema }),
          prompt: [
            `Topic: ${topic}`,
            examStyle ? `Exam style: ${examStyle}` : null,
            goal ? `Goal: ${goal}` : null,
            `Student work:\n${attemptsBlock}`,
            grounding.excerptBlock ? `Source material:\n${grounding.excerptBlock}` : null,
          ].filter((value): value is string => Boolean(value)).join('\n\n'),
        });

        return {
          success: true,
          ...output,
          groundedFromKnowledgeBase: grounding.sources.length > 0,
          groundingReferences: grounding.references,
          sources: grounding.sources,
        };
      },
    }),

    generate_flashcards: tool({
      description:
        'Generate study flashcards for revision. Use this when the user wants memorization prompts, key-term review cards, or quick recall practice. When selected documents are available, this tool automatically grounds the flashcards in those documents.',
      inputSchema: z.object({
        topic: z.string().min(1).describe('The subject or topic for the flashcards'),
        cardCount: z.number().int().min(1).max(20).optional().default(8).describe('Number of flashcards to generate'),
        examStyle: z.string().optional().describe('Optional exam style or curriculum, e.g. biology final or SAT vocab'),
        focusAreas: z.array(z.string()).optional().describe('Optional subtopics or concepts to emphasize'),
        sourceMaterial: z.string().optional().describe('Optional notes or excerpts to ground the flashcards'),
      }),
      async execute({ topic, cardCount, examStyle, focusAreas, sourceMaterial }) {
        const grounding = await getKnowledgeGrounding(
          [topic, examStyle, ...(focusAreas ?? [])].filter((value): value is string => Boolean(value)).join(' '),
          options,
        );

        const mergedSourceMaterial = [sourceMaterial, grounding.excerptBlock]
          .filter((value): value is string => Boolean(value))
          .join('\n\n');

        const { output } = await generateText({
          model: EXAM_PREP_MODEL,
          system: 'You create concise, high-quality study flashcards. Return only valid structured data that matches the schema. Make the front side a clear recall prompt and the back side a concise but informative answer. If source material is provided, base the flashcards on it and avoid inventing unsupported facts. When the source material includes numbered excerpts like [1] or [2], add the matching excerpt numbers to each flashcard\'s references array. Use only the provided excerpt numbers and leave references empty when support is weak or absent.',
          output: Output.object({ schema: flashcardOutputSchema }),
          prompt: [
            `Topic: ${topic}`,
            `Card count: ${cardCount}`,
            examStyle ? `Exam style: ${examStyle}` : null,
            focusAreas && focusAreas.length > 0 ? `Focus areas:\n- ${focusAreas.join('\n- ')}` : null,
            mergedSourceMaterial ? `Source material:\n${mergedSourceMaterial}` : null,
          ].filter((value): value is string => Boolean(value)).join('\n\n'),
        });

        return {
          success: true,
          ...output,
          groundedFromKnowledgeBase: grounding.sources.length > 0,
          groundingReferences: grounding.references,
          sources: grounding.sources,
        };
      },
    }),
  };
}
