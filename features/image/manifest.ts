import type { ToolManifest } from '@/features/tools/registry/types';
import { KIE_MEDIA_PROVIDER_METADATA } from '@/features/external-tools/media/metadata';

export const imageManifest: ToolManifest = {
  id: 'image',
  slug: 'image',
  title: 'Image Generator',
  description: 'Generate and edit images using KIE AI models — Nano Banana, GPT Image, Qwen, Grok, and more.',
  icon: 'Image',
  category: 'media',
  professions: ['all', 'marketer', 'business'],
  supportsAgent: true,
  supportsSidebar: true,
  supportsExport: false,
  defaultEnabled: false,
  sidebar: {
    order: 220,
  },
  access: {
    requiresAuth: true,
    enabled: true,
  },
  provider: KIE_MEDIA_PROVIDER_METADATA,
};
