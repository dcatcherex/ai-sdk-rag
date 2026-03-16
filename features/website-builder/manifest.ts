import type { ToolManifest } from '@/features/tools/registry/types';

export const websiteBuilderManifest: ToolManifest = {
  id: 'website_builder',
  slug: 'website-builder',
  title: 'Website Builder',
  description: 'Describe your business and AI builds a complete website. Chat to edit, then publish live.',
  icon: 'Globe',
  category: 'utilities',
  professions: ['all', 'business', 'marketer'],
  supportsAgent: true,
  supportsSidebar: true,
  supportsExport: true,
  defaultEnabled: false,
  access: { requiresAuth: true, enabled: true },
};
