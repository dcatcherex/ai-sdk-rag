export const SKILL_CATEGORY_OPTIONS = [
  'brand',
  'writing',
  'support',
  'sales',
  'research',
  'localization',
  'operations',
  'education',
  'marketing',
] as const;

export const SKILL_CATEGORY_LABELS: Record<string, string> = {
  brand: 'Brand',
  writing: 'Writing',
  support: 'Support',
  sales: 'Sales',
  research: 'Research',
  localization: 'Localization',
  operations: 'Operations',
  education: 'Education',
  marketing: 'Marketing',
  uncategorized: 'Uncategorized',
};

export type SkillCategory = (typeof SKILL_CATEGORY_OPTIONS)[number];
