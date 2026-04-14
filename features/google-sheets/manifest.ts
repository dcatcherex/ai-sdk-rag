import type { ToolManifest } from '@/features/tools/registry/types';

export const googleSheetsManifest: ToolManifest = {
  id: 'google_sheets',
  slug: 'google-sheets',
  title: 'Google Sheets',
  description: 'Read and update Google Sheets from agents or the control room.',
  icon: 'Table2',
  category: 'admin',
  professions: ['all', 'teacher', 'marketer', 'business'],
  supportsAgent: true,
  supportsSidebar: true,
  supportsExport: false,
  defaultEnabled: false,
  sidebar: {
    label: 'Sheets',
    order: 250,
  },
  access: {
    requiresAuth: true,
    enabled: true,
  },
};
