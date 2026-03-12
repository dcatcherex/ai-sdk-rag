import type { ToolManifest } from '@/features/tools/registry/types';

export const certificateManifest: ToolManifest = {
  id: 'certificate',
  slug: 'certificate',
  title: 'Certificate Generator',
  description:
    'Generate certificate images and PDFs from templates. Supports single and batch generation with custom fields.',
  icon: 'Award',
  category: 'content',
  professions: ['all', 'teacher', 'business'],
  supportsAgent: true,
  supportsSidebar: true,
  supportsExport: true,
  defaultEnabled: false,
  access: {
    requiresAuth: true,
    enabled: true,
  },
};
