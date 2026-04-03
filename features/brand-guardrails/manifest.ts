import type { ToolManifest } from '@/features/tools/registry/types';

export const brandGuardrailsManifest: ToolManifest = {
  id: 'brand_guardrails',
  slug: 'brand-guardrails',
  title: 'Brand Guardrails',
  description: 'Check content against brand rules, tone guidelines, and compliance requirements.',
  icon: 'ShieldCheck',
  category: 'content',
  professions: ['all', 'marketer', 'business'],
  supportsAgent: true,
  supportsSidebar: false,
  supportsExport: false,
  defaultEnabled: false,
  access: {
    requiresAuth: true,
    enabled: true,
  },
};
