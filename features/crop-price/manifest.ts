import type { ToolManifest } from '@/features/tools/registry/types';

export const cropPriceManifest: ToolManifest = {
  id: 'crop_price',
  slug: 'crop-price',
  title: 'Thai Crop Price Tracker',
  description: 'Look up current Thai farm-gate prices for major crops from OAE and DIT official sources. Useful for farmers deciding when and where to sell.',
  icon: 'Sprout',
  category: 'agriculture',
  professions: ['all'],
  supportsAgent: true,
  supportsSidebar: true,
  supportsExport: false,
  defaultEnabled: false,
  sidebar: { order: 200 },
  access: {
    requiresAuth: true,
    enabled: true,
  },
};
