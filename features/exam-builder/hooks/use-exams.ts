'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ExamDraft,
  ExamDraftWithQuestions,
  ExamQuestion,
  BankQuestion,
  ExportOptions,
  UpdateExamDraftInput,
  UpdateExamQuestionInput,
  GenerateExamQuestionsInput,
  CreateExamDraftInput,
  GeneratedQuestion,
} from '@/features/exam-builder/types';

// ── Query keys ────────────────────────────────────────────────────────────────

export const EXAM_KEYS = {
  all: ['exam-builder'] as const,
  exams: () => [...EXAM_KEYS.all, 'exams'] as const,
  exam: (id: string) => [...EXAM_KEYS.all, 'exams', id] as const,
  bank: (filters?: Record<string, string>) => [...EXAM_KEYS.all, 'bank', filters] as const,
};

// ── List exams ────────────────────────────────────────────────────────────────

export function useExams() {
  return useQuery<ExamDraft[]>({
    queryKey: EXAM_KEYS.exams(),
    queryFn: async () => {
      const res = await fetch('/api/tools/exam-builder/exams');
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });
}

// ── Single exam (with questions) ──────────────────────────────────────────────

export function useExam(examId: string | null) {
  return useQuery<ExamDraftWithQuestions>({
    queryKey: EXAM_KEYS.exam(examId ?? ''),
    queryFn: async () => {
      const res = await fetch(`/api/tools/exam-builder/exams/${examId}`);
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    enabled: !!examId,
  });
}

// ── Create exam ───────────────────────────────────────────────────────────────

export function useCreateExam() {
  const qc = useQueryClient();
  return useMutation<ExamDraft, Error, CreateExamDraftInput>({
    mutationFn: async (input) => {
      const res = await fetch('/api/tools/exam-builder/exams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: EXAM_KEYS.exams() }),
  });
}

// ── Update exam ───────────────────────────────────────────────────────────────

export function useUpdateExam(examId: string) {
  const qc = useQueryClient();
  return useMutation<ExamDraft, Error, UpdateExamDraftInput>({
    mutationFn: async (patch) => {
      const res = await fetch(`/api/tools/exam-builder/exams/${examId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: EXAM_KEYS.exams() });
      qc.invalidateQueries({ queryKey: EXAM_KEYS.exam(examId) });
    },
  });
}

// ── Delete exam ───────────────────────────────────────────────────────────────

export function useDeleteExam() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (examId) => {
      const res = await fetch(`/api/tools/exam-builder/exams/${examId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: EXAM_KEYS.exams() }),
  });
}

// ── Generate questions (AI) ───────────────────────────────────────────────────

export function useGenerateQuestions() {
  return useMutation<{ questions: GeneratedQuestion[] }, Error, GenerateExamQuestionsInput>({
    mutationFn: async (input) => {
      const res = await fetch('/api/tools/exam-builder/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });
}

// ── Add questions to exam ─────────────────────────────────────────────────────

export function useAddQuestions(examId: string) {
  const qc = useQueryClient();
  return useMutation<ExamQuestion[], Error, GeneratedQuestion[]>({
    mutationFn: async (questions) => {
      const res = await fetch(`/api/tools/exam-builder/exams/${examId}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questions }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: EXAM_KEYS.exam(examId) }),
  });
}

// ── Update question ───────────────────────────────────────────────────────────

export function useUpdateQuestion(examId: string) {
  const qc = useQueryClient();
  return useMutation<ExamQuestion, Error, { questionId: string; patch: UpdateExamQuestionInput }>({
    mutationFn: async ({ questionId, patch }) => {
      const res = await fetch(`/api/tools/exam-builder/questions/${questionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: EXAM_KEYS.exam(examId) }),
  });
}

// ── Delete question ───────────────────────────────────────────────────────────

export function useDeleteQuestion(examId: string) {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (questionId) => {
      const res = await fetch(`/api/tools/exam-builder/questions/${questionId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: EXAM_KEYS.exam(examId) }),
  });
}

// ── Export exam ───────────────────────────────────────────────────────────────

export function useExportExam(examId: string) {
  return useMutation<{ examHtml: string; answerKeyHtml: string }, Error, ExportOptions>({
    mutationFn: async (opts) => {
      const res = await fetch(`/api/tools/exam-builder/exams/${examId}/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(opts),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });
}

// ── Question bank ─────────────────────────────────────────────────────────────

export function useBankQuestions(filters?: Record<string, string>) {
  return useQuery<BankQuestion[]>({
    queryKey: EXAM_KEYS.bank(filters),
    queryFn: async () => {
      const params = new URLSearchParams(filters ?? {});
      const res = await fetch(`/api/tools/exam-builder/bank?${params}`);
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });
}

export function useAddBankQuestionToExam(examId: string) {
  const qc = useQueryClient();
  return useMutation<ExamQuestion, Error, string>({
    mutationFn: async (bankQuestionId) => {
      const res = await fetch(`/api/tools/exam-builder/bank/${bankQuestionId}/use`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ examId }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: EXAM_KEYS.exam(examId) });
      qc.invalidateQueries({ queryKey: EXAM_KEYS.bank() });
    },
  });
}
