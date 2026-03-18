import { z } from 'zod';

// ── Shared enums ──────────────────────────────────────────────────────────────

export const examQuestionTypeSchema = z.enum(['mcq', 'true_false', 'short_answer', 'essay', 'matching']);
export const examBloomsLevelSchema = z.enum(['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create']);
export const examLanguageSchema = z.enum(['th', 'en']);

// ── AI generation ─────────────────────────────────────────────────────────────

export const generateExamQuestionsInputSchema = z.object({
  topic: z.string().min(1).describe('The topic or learning objective to generate questions for'),
  subject: z.string().min(1).describe('Thai curriculum subject (e.g. คณิตศาสตร์, วิทยาศาสตร์)'),
  gradeLevel: z.string().min(1).describe('Grade level e.g. ป.4, ม.1, ม.4'),
  language: examLanguageSchema.default('th').describe('Output language: th = Thai, en = English'),
  questionTypes: z.array(examQuestionTypeSchema).min(1).describe('Which question formats to generate'),
  bloomsLevels: z.array(examBloomsLevelSchema).min(1).describe('Bloom taxonomy levels to target'),
  countPerType: z.number().int().min(1).max(10).default(3).describe('How many questions per type'),
  sourceMaterial: z.string().optional().describe('Optional reference text to base questions on'),
});

export const generatedQuestionSchema = z.object({
  type: examQuestionTypeSchema,
  text: z.string().min(1),
  /** MCQ/T-F: string[], Matching: { left: string[], right: string[] }, Short/Essay: null */
  options: z.union([
    z.array(z.string()),
    z.object({ left: z.array(z.string()), right: z.array(z.string()) }),
    z.null(),
  ]),
  answer: z.string().min(1),
  explanation: z.string(),
  bloomsLevel: examBloomsLevelSchema,
  points: z.number().int().min(1).max(10),
});

export const generateExamQuestionsOutputSchema = z.object({
  questions: z.array(generatedQuestionSchema),
});

// ── Exam CRUD ─────────────────────────────────────────────────────────────────

export const examHeaderInfoSchema = z.object({
  schoolName: z.string().optional(),
  teacherName: z.string().optional(),
  className: z.string().optional(),
  examDate: z.string().optional(),
  timeLimit: z.string().optional(),
});

export const createExamDraftInputSchema = z.object({
  title: z.string().min(1),
  subject: z.string().min(1),
  gradeLevel: z.string().min(1),
  language: examLanguageSchema.default('th'),
  instructions: z.string().optional(),
  headerInfo: examHeaderInfoSchema.optional(),
  enabledTypes: z.array(examQuestionTypeSchema).min(1).default(['mcq']),
  enabledBloomsLevels: z.array(examBloomsLevelSchema).min(1).default(['remember', 'understand', 'apply']),
});

export const updateExamDraftInputSchema = createExamDraftInputSchema.partial().extend({
  status: z.enum(['draft', 'finalized']).optional(),
});

// ── Question management ───────────────────────────────────────────────────────

export const updateExamQuestionInputSchema = z.object({
  text: z.string().min(1).optional(),
  options: z.union([
    z.array(z.string()),
    z.object({ left: z.array(z.string()), right: z.array(z.string()) }),
    z.null(),
  ]).optional(),
  answer: z.string().min(1).optional(),
  explanation: z.string().optional(),
  bloomsLevel: examBloomsLevelSchema.optional(),
  points: z.number().int().min(1).optional(),
  orderIndex: z.number().int().min(0).optional(),
});

export const reorderQuestionsInputSchema = z.object({
  orderedIds: z.array(z.string()).min(1),
});

// ── Export ────────────────────────────────────────────────────────────────────

export const exportExamInputSchema = z.object({
  showPoints: z.boolean().default(true),
  includeHeader: z.boolean().default(true),
  answerSheetStyle: z.enum(['lines', 'none']).default('lines'),
});

// ── Agent tool schemas ────────────────────────────────────────────────────────

export const agentGenerateExamSchema = generateExamQuestionsInputSchema;

export const agentCreateExamSchema = createExamDraftInputSchema.extend({
  questions: z.array(generatedQuestionSchema).optional(),
});

export const agentExportExamSchema = z.object({
  examId: z.string().min(1).describe('The exam draft ID to export'),
  showPoints: z.boolean().default(true),
  includeHeader: z.boolean().default(true),
  answerSheetStyle: z.enum(['lines', 'none']).default('lines'),
});

// ── Bank ──────────────────────────────────────────────────────────────────────

export const bankFilterSchema = z.object({
  subject: z.string().optional(),
  gradeLevel: z.string().optional(),
  type: examQuestionTypeSchema.optional(),
  bloomsLevel: examBloomsLevelSchema.optional(),
});
