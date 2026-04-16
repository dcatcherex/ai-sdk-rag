import type { ToolManifest } from '@/features/tools/registry/types';

export const platformAgentManifest: ToolManifest = {
  id: 'platform_agent',
  slug: 'platform-agent',
  title: 'Vaja Platform Agent',
  description:
    'Manage your Vaja AI workspace through conversation — create agents, install skills, start threads, review credits, and configure your LINE OA.',
  icon: 'Bot',
  category: 'admin',
  professions: ['all'],
  supportsAgent: true,
  supportsSidebar: false,
  supportsExport: false,
  defaultEnabled: false,
  access: {
    requiresAuth: true,
    enabled: true,
  },
};
