import type { ToolManifest } from '@/features/tools/registry/types';

export const recordKeeperManifest: ToolManifest = {
  id: 'record_keeper',
  slug: 'record-keeper',
  title: 'Activity Record Keeper',
  description:
    'Log and retrieve structured activity records for any profession — farm activities, class sessions, patient notes, and more. Supports logging, querying, and summarization via conversation.',
  icon: 'BookOpen',
  category: 'utilities',
  professions: ['all'],
  supportsAgent: true,
  supportsSidebar: false,
  supportsExport: false,
  defaultEnabled: false,
  access: {
    requiresAuth: true,
    enabled: true,
  },
};
