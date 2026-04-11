import type { ToolManifest } from '@/features/tools/registry/types';

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
};
