import type { ToolManifest } from '@/features/tools/registry/types';
import { GOOGLE_WORKSPACE_PROVIDER_METADATA } from '@/features/external-tools/integrations/metadata';

export const googleSlidesManifest: ToolManifest = {
  id: 'google_slides',
  slug: 'google-slides',
  title: 'Google Slides',
  description: 'Generate lesson decks and presentation outlines in Google Slides.',
  icon: 'Presentation',
  category: 'admin',
  professions: ['all', 'teacher', 'marketer', 'business'],
  supportsAgent: true,
  supportsSidebar: true,
  supportsExport: false,
  defaultEnabled: false,
  sidebar: {
    label: 'Slides',
    order: 253,
  },
  access: {
    requiresAuth: true,
    enabled: true,
  },
  provider: GOOGLE_WORKSPACE_PROVIDER_METADATA,
};
