import { relations, sql } from "drizzle-orm";
import { index, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { user } from "./auth";

// ── Exam Builder ──────────────────────────────────────────────────────────────

export type ExamQuestionType = "mcq" | "true_false" | "short_answer" | "essay" | "matching";
export type ExamBloomsLevel = "remember" | "understand" | "apply" | "analyze" | "evaluate" | "create";
export type ExamLanguage = "th" | "en";
export type ExamStatus = "draft" | "finalized";
export type ExamHeaderInfo = {
  schoolName?: string;
  teacherName?: string;
  className?: string;
  examDate?: string;
  timeLimit?: string;
};
// MCQ/T-F: string[], Matching: { left: string[]; right: string[] }, Short/Essay: null
export type ExamQuestionOptions = string[] | { left: string[]; right: string[] } | null;

export const examDraft = pgTable("exam_draft", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  subject: text("subject").notNull(),
  gradeLevel: text("grade_level").notNull(),
  language: text("language").$type<ExamLanguage>().notNull().default("th"),
  instructions: text("instructions"),
  headerInfo: jsonb("header_info").$type<ExamHeaderInfo>().notNull().default(sql`'{}'::jsonb`),
  enabledTypes: text("enabled_types").array().notNull().default(sql`'{mcq}'::text[]`),
  enabledBloomsLevels: text("enabled_blooms_levels").array().notNull().default(sql`'{remember,understand,apply}'::text[]`),
  totalPoints: integer("total_points").notNull().default(0),
  status: text("status").$type<ExamStatus>().notNull().default("draft"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => [
  index("exam_draft_userId_idx").on(table.userId),
]);

export const examQuestion = pgTable("exam_question", {
  id: text("id").primaryKey(),
  examId: text("exam_id").notNull().references(() => examDraft.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  type: text("type").$type<ExamQuestionType>().notNull(),
  text: text("text").notNull(),
  options: jsonb("options").$type<ExamQuestionOptions>(),
  answer: text("answer").notNull(),
  explanation: text("explanation").notNull().default(""),
  bloomsLevel: text("blooms_level").$type<ExamBloomsLevel>().notNull(),
  points: integer("points").notNull().default(1),
  orderIndex: integer("order_index").notNull().default(0),
  subject: text("subject").notNull().default(""),
  gradeLevel: text("grade_level").notNull().default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("exam_question_examId_idx").on(table.examId),
  index("exam_question_userId_idx").on(table.userId),
]);

export const examQuestionBank = pgTable("exam_question_bank", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  sourceExamId: text("source_exam_id").references(() => examDraft.id, { onDelete: "set null" }),
  type: text("type").$type<ExamQuestionType>().notNull(),
  text: text("text").notNull(),
  options: jsonb("options").$type<ExamQuestionOptions>(),
  answer: text("answer").notNull(),
  explanation: text("explanation").notNull().default(""),
  bloomsLevel: text("blooms_level").$type<ExamBloomsLevel>().notNull(),
  defaultPoints: integer("default_points").notNull().default(1),
  subject: text("subject").notNull(),
  gradeLevel: text("grade_level").notNull(),
  tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
  useCount: integer("use_count").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("exam_bank_userId_idx").on(table.userId),
  index("exam_bank_subject_idx").on(table.subject),
  index("exam_bank_type_idx").on(table.type),
]);

export const examDraftRelations = relations(examDraft, ({ one, many }) => ({
  user: one(user, { fields: [examDraft.userId], references: [user.id] }),
  questions: many(examQuestion),
  bankQuestions: many(examQuestionBank),
}));

export const examQuestionRelations = relations(examQuestion, ({ one }) => ({
  exam: one(examDraft, { fields: [examQuestion.examId], references: [examDraft.id] }),
  user: one(user, { fields: [examQuestion.userId], references: [user.id] }),
}));

export const examQuestionBankRelations = relations(examQuestionBank, ({ one }) => ({
  user: one(user, { fields: [examQuestionBank.userId], references: [user.id] }),
  sourceExam: one(examDraft, { fields: [examQuestionBank.sourceExamId], references: [examDraft.id] }),
}));
