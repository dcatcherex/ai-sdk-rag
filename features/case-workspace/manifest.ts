import type { ToolManifest } from '@/features/tools/registry/types';

export const caseWorkspaceManifest: ToolManifest = {
  id: 'case_workspace',
  slug: 'case-workspace',
  title: 'Case Workspace',
  description:
    'Manage contacts, cases, tasks, notes, files, and follow-ups for common professional workflows.',
  icon: 'BriefcaseBusiness',
  category: 'utilities',
  professions: ['all', 'business', 'teacher', 'marketer', 'minimal'],
  supportsAgent: true,
  supportsSidebar: true,
  supportsExport: true,
  defaultEnabled: true,
  sidebar: {
    label: 'Case Workspace',
    defaultPinned: true,
    order: 145,
  },
  access: {
    requiresAuth: true,
    enabled: true,
  },
};
