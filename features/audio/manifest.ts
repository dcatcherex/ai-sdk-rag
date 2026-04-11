import type { ToolManifest } from '@/features/tools/registry/types';

export const audioManifest: ToolManifest = {
  id: 'audio',
  slug: 'audio',
  title: 'Music Generator',
  description: 'Generate AI music and songs using Suno. Create custom tracks with style controls, vocal settings, and more.',
  icon: 'Music2',
  category: 'media',
  professions: ['all', 'marketer', 'business'],
  supportsAgent: true,
  supportsSidebar: true,
  supportsExport: false,
  defaultEnabled: false,
  sidebar: {
    order: 190,
  },
  access: {
    requiresAuth: true,
    enabled: true,
  },
};
