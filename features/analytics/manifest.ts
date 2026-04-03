import type { ToolManifest } from '@/features/tools/registry/types';

export const analyticsManifest: ToolManifest = {
  id: 'content_analytics',
  slug: 'analytics',
  title: 'Content Analytics',
  description:
    'Track content performance metrics across platforms. Log views, clicks, engagement and conversions. Get AI-powered performance analysis and optimization recommendations.',
  icon: 'BarChart2',
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
