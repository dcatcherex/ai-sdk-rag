import type { ToolManifest } from '@/features/tools/registry/types';

export const repurposingManifest: ToolManifest = {
  id: 'repurposing',
  slug: 'repurposing',
  title: 'Content Repurposing',
  description:
    'Transform any content into multiple formats — blog posts, newsletters, LinkedIn posts, tweet threads, ad copy, and more.',
  icon: 'RefreshCw',
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
