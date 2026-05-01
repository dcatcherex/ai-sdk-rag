import type { ToolManifest } from '@/features/tools/registry/types';

export const collaborationManifest: ToolManifest = {
  id: 'collaboration',
  slug: 'collaboration',
  title: 'Collaboration',
  description:
    'Submit content for review and create approval requests when work needs human sign-off.',
  icon: 'MessageSquareMore',
  category: 'admin',
  professions: ['all', 'teacher', 'marketer', 'developer', 'business', 'minimal'],
  supportsAgent: true,
  supportsSidebar: false,
  supportsExport: false,
  defaultEnabled: false,
  access: {
    requiresAuth: true,
    enabled: true,
  },
};
