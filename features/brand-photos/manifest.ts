import type { ToolManifest } from '@/features/tools/registry/types';

export const brandPhotosManifest: ToolManifest = {
  id: 'brand_photos',
  slug: 'brand-photos',
  title: 'Brand Photos',
  description:
    'Upload your product photos, activity shots, and working images so AI can use them when creating social posts — picked automatically and spread evenly across all uploaded photos.',
  icon: 'Images',
  category: 'content',
  professions: ['all', 'marketer', 'business'],
  supportsAgent: true,
  supportsSidebar: false,
  supportsExport: false,
  defaultEnabled: false,
  access: {
    requiresAuth: true,
    enabled: true,
  },
};
