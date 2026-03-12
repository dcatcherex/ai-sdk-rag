import { z } from 'zod';

// ── Shared building blocks ────────────────────────────────────────────────────

export const referenceIdsSchema = z.array(z.number().int().min(1)).default([]);

export const referencedTextSchema = z.object({
  text: z.string(),
  references: referenceIdsSchema,
});

// ── Quiz ─────────────────────────────────────────────────────────────────────

export const quizQuestionSchema = z.object({
  id: z.string(),
  type: z.enum(['mcq', 'short_answer', 'true_false']),
  question: z.string(),
  options: z.array(z.string()).optional(),
  answer: z.string(),
  explanation: z.string(),
  topic: z.string(),
  references: referenceIdsSchema,
});

export const quizOutputSchema = z.object({
  instructions: z.string(),
  quiz: z.array(quizQuestionSchema),
});

export const generatePracticeQuizInputSchema = z.object({
  topic: z.string().min(1).describe('The subject or topic to generate questions about'),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional().default('medium'),
  questionCount: z.number().int().min(1).max(10).optional().default(5),
  format: z.enum(['mcq', 'short_answer', 'true_false', 'mixed']).optional().default('mixed'),
  examStyle: z.string().optional(),
  sourceMaterial: z.string().optional(),
});

export type GeneratePracticeQuizInput = z.infer<typeof generatePracticeQuizInputSchema>;

// ── Grading ───────────────────────────────────────────────────────────────────

export const gradingOutputSchema = z.object({
  score: z.number().min(0).max(10),
  maxScore: z.number().min(1).max(10),
  verdict: z.string(),
  strengths: z.array(referencedTextSchema),
  missingPoints: z.array(referencedTextSchema),
  improvements: z.array(referencedTextSchema),
  modelAnswer: z.string(),
});

export const gradePracticeAnswerInputSchema = z.object({
  question: z.string().min(1),
  userAnswer: z.string().min(1),
  expectedAnswer: z.string().optional(),
  rubric: z.array(z.string()).optional(),
  strictness: z.enum(['lenient', 'balanced', 'strict']).optional().default('balanced'),
});

export type GradePracticeAnswerInput = z.infer<typeof gradePracticeAnswerInputSchema>;

// ── Study plan ────────────────────────────────────────────────────────────────

export const studyPlanDaySchema = z.object({
  day: z.string(),
  focus: z.string(),
  tasks: z.array(referencedTextSchema),
  estimatedHours: z.number().min(0.5).max(24),
});

export const studyPlanOutputSchema = z.object({
  daysRemaining: z.number().int().min(0),
  priorityTopics: z.array(z.string()),
  plan: z.array(studyPlanDaySchema),
});

export const createStudyPlanInputSchema = z.object({
  examDate: z.string().min(1),
  topics: z.array(z.string()).min(1),
  weakTopics: z.array(z.string()).optional(),
  hoursPerDay: z.number().min(0.5).max(24).optional().default(2),
  goal: z.string().optional(),
});

export type CreateStudyPlanInput = z.infer<typeof createStudyPlanInputSchema>;

// ── Learning gaps ─────────────────────────────────────────────────────────────

export const learningGapItemSchema = z.object({
  topic: z.string(),
  issue: z.string(),
  severity: z.enum(['high', 'medium', 'low']),
  references: referenceIdsSchema,
});

export const learningGapOutputSchema = z.object({
  overallAssessment: z.string(),
  weakAreas: z.array(learningGapItemSchema),
  misconceptions: z.array(referencedTextSchema),
  recommendedActions: z.array(referencedTextSchema),
  nextStudyFocus: z.array(z.string()),
});

export const analyzeLearningGapsInputSchema = z.object({
  topic: z.string().min(1),
  studentWork: z.array(z.object({
    question: z.string().min(1),
    studentAnswer: z.string().min(1),
    correctAnswer: z.string().optional(),
    score: z.number().min(0).max(100).optional(),
    maxScore: z.number().min(1).max(100).optional(),
    feedback: z.string().optional(),
  })).min(1),
  examStyle: z.string().optional(),
  goal: z.string().optional(),
});

export type AnalyzeLearningGapsInput = z.infer<typeof analyzeLearningGapsInputSchema>;

// ── Flashcards ────────────────────────────────────────────────────────────────

export const flashcardSchema = z.object({
  id: z.string(),
  front: z.string(),
  back: z.string(),
  topic: z.string(),
  references: referenceIdsSchema,
});

export const flashcardOutputSchema = z.object({
  deckTitle: z.string(),
  studyTip: z.string(),
  flashcards: z.array(flashcardSchema),
});

export const generateFlashcardsInputSchema = z.object({
  topic: z.string().min(1),
  cardCount: z.number().int().min(1).max(20).optional().default(8),
  examStyle: z.string().optional(),
  focusAreas: z.array(z.string()).optional(),
  sourceMaterial: z.string().optional(),
});

export type GenerateFlashcardsInput = z.infer<typeof generateFlashcardsInputSchema>;
