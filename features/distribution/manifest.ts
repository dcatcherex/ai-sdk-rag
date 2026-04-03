import type { ToolManifest } from '@/features/tools/registry/types';

export const distributionManifest: ToolManifest = {
  id: 'distribution',
  slug: 'distribution',
  title: 'Content Distribution',
  description:
    'Distribute your content across channels. Send email campaigns via Resend, export to Markdown/HTML/plain text, or push to any CMS via webhook.',
  icon: 'Send',
  category: 'content',
  professions: ['all', 'marketer', 'business'],
  supportsAgent: true,
  supportsSidebar: false,
  supportsExport: true,
  defaultEnabled: false,
  access: {
    requiresAuth: true,
    enabled: true,
  },
};
