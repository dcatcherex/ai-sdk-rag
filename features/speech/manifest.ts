import type { ToolManifest } from '@/features/tools/registry/types';
import { KIE_MEDIA_PROVIDER_METADATA } from '@/features/external-tools/media/metadata';

export const speechManifest: ToolManifest = {
  id: 'speech',
  slug: 'speech',
  title: 'Speech Generator',
  description: 'Convert text to speech with ElevenLabs. Supports single-voice TTS and multi-speaker dialogue generation.',
  icon: 'Mic2',
  category: 'media',
  professions: ['all', 'marketer', 'business', 'teacher'],
  supportsAgent: true,
  supportsSidebar: true,
  supportsExport: false,
  defaultEnabled: false,
  sidebar: {
    order: 200,
  },
  access: {
    requiresAuth: true,
    enabled: true,
  },
  provider: KIE_MEDIA_PROVIDER_METADATA,
};
