import type { ToolManifest } from '@/features/tools/registry/types';

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
  access: {
    requiresAuth: true,
    enabled: true,
  },
};
