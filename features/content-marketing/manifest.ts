import type { ToolManifest } from '@/features/tools/registry/types';

export const contentMarketingManifest: ToolManifest = {
  id: 'content_marketing',
  slug: 'content-marketing',
  title: 'Content Marketing',
  description:
    'Create and schedule social media posts for Instagram, Facebook, and TikTok. Generate AI captions, upload or generate images, and manage your content calendar.',
  icon: 'Share2',
  category: 'content',
  professions: ['all', 'marketer', 'business'],
  supportsAgent: true,
  supportsSidebar: true,
  supportsExport: false,
  defaultEnabled: false,
  sidebar: {
    order: 140,
  },
  access: {
    requiresAuth: true,
    enabled: true,
  },
};
