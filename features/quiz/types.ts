import type { z } from 'zod';
import type {
  quizOutputSchema,
  gradingOutputSchema,
  studyPlanOutputSchema,
  learningGapOutputSchema,
  flashcardOutputSchema,
} from './schema';

export type QuizOutput = z.infer<typeof quizOutputSchema>;
export type GradingOutput = z.infer<typeof gradingOutputSchema>;
export type StudyPlanOutput = z.infer<typeof studyPlanOutputSchema>;
export type LearningGapOutput = z.infer<typeof learningGapOutputSchema>;
export type FlashcardOutput = z.infer<typeof flashcardOutputSchema>;

export type GroundingReference = {
  id: number;
  source: string;
  page?: number | null;
  section?: string;
  documentId?: string;
};

export type GroundedResult = {
  groundedFromKnowledgeBase: boolean;
  groundingReferences: GroundingReference[];
  sources: string[];
};
