import type { ToolManifest } from '@/features/tools/registry/types';
import { KIE_MEDIA_PROVIDER_METADATA } from '@/features/external-tools/media/metadata';

export const videoManifest: ToolManifest = {
  id: 'video',
  slug: 'video',
  title: 'Video Generator',
  description: 'Generate AI videos using Veo. Supports text-to-video, image-to-video, and reference-based generation.',
  icon: 'Video',
  category: 'media',
  professions: ['all', 'marketer', 'business'],
  supportsAgent: true,
  supportsSidebar: true,
  supportsExport: false,
  defaultEnabled: false,
  sidebar: {
    order: 210,
  },
  access: {
    requiresAuth: true,
    enabled: true,
  },
  provider: KIE_MEDIA_PROVIDER_METADATA,
};
