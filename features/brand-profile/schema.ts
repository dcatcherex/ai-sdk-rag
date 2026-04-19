import { z } from 'zod';

export const REQUIRED_FIELDS = ['brand_name', 'products', 'tone', 'target_audience'] as const;
export type RequiredField = typeof REQUIRED_FIELDS[number];

export const BRAND_FIELDS = [
  ...REQUIRED_FIELDS,
  'usp',
  'price_range',
  'competitors',
  'keywords',
] as const;
export type BrandField = typeof BRAND_FIELDS[number];

// ── get_brand_profile ─────────────────────────────────────────────────────────

export const getBrandProfileInputSchema = z.object({}).describe('No input needed — returns all stored brand profile fields for the current user.');

export type GetBrandProfileInput = z.infer<typeof getBrandProfileInputSchema>;

export const brandProfileOutputSchema = z.object({
  fields: z.record(z.string(), z.string()).describe('All stored brand profile fields as key-value pairs'),
  missingRequired: z.array(z.string()).describe('Required fields that have not been filled in yet'),
  isComplete: z.boolean().describe('True when all required fields are present'),
});

export type BrandProfileOutput = z.infer<typeof brandProfileOutputSchema>;

// ── save_brand_profile ────────────────────────────────────────────────────────

export const saveBrandProfileInputSchema = z.object({
  field: z
    .string()
    .min(1)
    .describe(
      'The field to save. Required fields: brand_name, products, tone, target_audience. Optional: usp, price_range, competitors, keywords.',
    ),
  value: z.string().min(1).describe('The value to store for this field.'),
});

export type SaveBrandProfileInput = z.infer<typeof saveBrandProfileInputSchema>;

export const saveBrandProfileOutputSchema = z.object({
  saved: z.boolean(),
  field: z.string(),
  value: z.string(),
  missingRequired: z.array(z.string()).describe('Required fields still missing after this save'),
  isComplete: z.boolean(),
});

export type SaveBrandProfileOutput = z.infer<typeof saveBrandProfileOutputSchema>;
