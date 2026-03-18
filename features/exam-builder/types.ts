import type {
  ExamQuestionType,
  ExamBloomsLevel,
  ExamLanguage,
  ExamStatus,
  ExamHeaderInfo,
  ExamQuestionOptions,
} from '@/db/schema';
import type { z } from 'zod';
import type {
  generateExamQuestionsOutputSchema,
  createExamDraftInputSchema,
  updateExamDraftInputSchema,
  updateExamQuestionInputSchema,
  exportExamInputSchema,
  generateExamQuestionsInputSchema,
} from './schema';

export type {
  ExamQuestionType,
  ExamBloomsLevel,
  ExamLanguage,
  ExamStatus,
  ExamHeaderInfo,
  ExamQuestionOptions,
};

export type GeneratedQuestion = z.infer<typeof generateExamQuestionsOutputSchema>['questions'][number];
export type GenerateExamQuestionsInput = z.infer<typeof generateExamQuestionsInputSchema>;
export type CreateExamDraftInput = z.infer<typeof createExamDraftInputSchema>;
export type UpdateExamDraftInput = z.infer<typeof updateExamDraftInputSchema>;
export type UpdateExamQuestionInput = z.infer<typeof updateExamQuestionInputSchema>;
export type ExportExamInput = z.infer<typeof exportExamInputSchema>;

export type ExamQuestion = {
  id: string;
  examId: string;
  userId: string;
  type: ExamQuestionType;
  text: string;
  options: ExamQuestionOptions;
  answer: string;
  explanation: string;
  bloomsLevel: ExamBloomsLevel;
  points: number;
  orderIndex: number;
  subject: string;
  gradeLevel: string;
  createdAt: Date;
};

export type ExamDraft = {
  id: string;
  userId: string;
  title: string;
  subject: string;
  gradeLevel: string;
  language: ExamLanguage;
  instructions: string | null;
  headerInfo: ExamHeaderInfo;
  enabledTypes: string[];
  enabledBloomsLevels: string[];
  totalPoints: number;
  status: ExamStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type ExamDraftWithQuestions = ExamDraft & {
  questions: ExamQuestion[];
};

export type BankQuestion = {
  id: string;
  userId: string;
  sourceExamId: string | null;
  type: ExamQuestionType;
  text: string;
  options: ExamQuestionOptions;
  answer: string;
  explanation: string;
  bloomsLevel: ExamBloomsLevel;
  defaultPoints: number;
  subject: string;
  gradeLevel: string;
  tags: string[];
  useCount: number;
  createdAt: Date;
};

export type ExportOptions = {
  showPoints: boolean;
  includeHeader: boolean;
  answerSheetStyle: 'lines' | 'none';
};
