import type { ToolManifest } from '@/features/tools/registry/types';
import { WEBSITE_BUILDER_PROVIDER_METADATA } from '@/features/external-tools/web-publisher/metadata';

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
  sidebar: {
    order: 180,
  },
  access: { requiresAuth: true, enabled: true },
  provider: WEBSITE_BUILDER_PROVIDER_METADATA,
};
