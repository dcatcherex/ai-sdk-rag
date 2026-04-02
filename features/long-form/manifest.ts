import type { ToolManifest } from '@/features/tools/registry/types';

export const longFormManifest: ToolManifest = {
  id: 'long_form',
  slug: 'long-form',
  title: 'Long-form Content',
  description:
    'Generate SEO-optimized blog posts, newsletters, email sequences, and landing page copy powered by AI.',
  icon: 'FileText',
  category: 'content',
  professions: ['all', 'marketer', 'business'],
  supportsAgent: true,
  supportsSidebar: true,
  supportsExport: false,
  defaultEnabled: false,
  access: {
    requiresAuth: true,
    enabled: true,
  },
};
