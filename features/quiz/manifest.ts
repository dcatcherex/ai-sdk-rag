import type { ToolManifest } from '@/features/tools/registry/types';

export const quizManifest: ToolManifest = {
  id: 'exam_prep',
  slug: 'quiz',
  title: 'Quiz & Exam Prep',
  description:
    'Generate practice quizzes, grade answers, create study plans, analyze learning gaps, and build flashcards — grounded in your documents.',
  icon: 'GraduationCap',
  category: 'study',
  professions: ['all', 'teacher'],
  supportsAgent: true,
  supportsSidebar: true,
  supportsExport: true,
  defaultEnabled: false,
  access: {
    requiresAuth: true,
    enabled: true,
  },
};
