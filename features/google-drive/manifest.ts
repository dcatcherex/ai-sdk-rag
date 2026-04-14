import type { ToolManifest } from '@/features/tools/registry/types';

export const googleDriveManifest: ToolManifest = {
  id: 'google_drive',
  slug: 'google-drive',
  title: 'Google Drive',
  description: 'Store generated files and browse Google Drive folders from Vaja.',
  icon: 'FolderOpen',
  category: 'admin',
  professions: ['all', 'teacher', 'marketer', 'business'],
  supportsAgent: true,
  supportsSidebar: true,
  supportsExport: true,
  defaultEnabled: false,
  sidebar: {
    label: 'Drive',
    order: 252,
  },
  access: {
    requiresAuth: true,
    enabled: true,
  },
};
