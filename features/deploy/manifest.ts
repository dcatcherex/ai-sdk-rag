import type { ToolManifest } from '@/features/tools/registry/types'

export const webDeployManifest: ToolManifest = {
  id: 'web_deploy',
  slug: 'web-deploy',
  title: 'Web Publisher',
  description:
    'Edit website copy, clone pages with new content, and publish blog posts — all via GitHub PR with a Vercel preview deployment. Every change goes through a preview and approval step before anything is committed.',
  icon: 'GitPullRequest',
  category: 'developer',
  professions: ['all', 'developer'],
  supportsAgent: true,
  supportsSidebar: true,
  supportsExport: false,
  defaultEnabled: false,
  sidebar: {
    label: 'Web Publisher',
    order: 200,
  },
  access: {
    requiresAuth: true,
    roles: ['admin'],
    enabled: true,
  },
}
