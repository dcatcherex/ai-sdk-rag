import type { ToolManifest } from '@/features/tools/registry/types';

export const brandProfileManifest: ToolManifest = {
  id: 'brand_profile',
  slug: 'brand-profile',
  title: 'Brand Profile',
  description:
    'Store and retrieve brand guidelines — name, products, tone, target audience, and USP — so content agents always generate on-brand output without asking twice.',
  icon: 'BookMarked',
  category: 'content',
  professions: ['all', 'marketer'],
  supportsAgent: true,
  supportsSidebar: true,
  supportsExport: false,
  defaultEnabled: true,
  access: {
    requiresAuth: false,
    enabled: true,
  },
};
