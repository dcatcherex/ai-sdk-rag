import type { ToolManifest } from '@/features/tools/registry/types';
import { GOOGLE_WORKSPACE_PROVIDER_METADATA } from '@/features/external-tools/integrations/metadata';

export const googleDocsManifest: ToolManifest = {
  id: 'google_docs',
  slug: 'google-docs',
  title: 'Google Docs',
  description: 'Create handouts, worksheets, and structured Google Docs from Vaja.',
  icon: 'FileText',
  category: 'admin',
  professions: ['all', 'teacher', 'marketer', 'business'],
  supportsAgent: true,
  supportsSidebar: true,
  supportsExport: false,
  defaultEnabled: false,
  sidebar: {
    label: 'Docs',
    order: 251,
  },
  access: {
    requiresAuth: true,
    enabled: true,
  },
  provider: GOOGLE_WORKSPACE_PROVIDER_METADATA,
};
