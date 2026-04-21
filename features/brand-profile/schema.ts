import { z } from 'zod';

// ── Field configuration ───────────────────────────────────────────────────────
// To change what's required: edit REQUIRED_FIELDS only.
// To add/remove fields entirely: edit FIELD_ORDER in the tool page + add here.

/** Minimum fields the agent must collect before generating content. */
export const REQUIRED_FIELDS = ['products', 'tone'] as const;
export type RequiredField = typeof REQUIRED_FIELDS[number];

/** All supported fields in priority order (required first, then optional). */
export const BRAND_FIELDS = [
  'products',        // required — what to write about
  'tone',            // required — how it should sound
  'brand_name',      // optional — substitutes a name in copy
  'target_audience', // optional — sharpens the angle
  'usp',             // optional — differentiator / hook
  'price_range',     // optional — anchors value messaging
  'competitors',     // optional — positioning context
  'keywords',        // optional — hashtags / SEO terms
  // messaging
  'brand_voice_examples',  // optional — example captions/messages in the brand's voice
  'do_not_say',            // optional — words/phrases to avoid (brand safety)
  'promotion_style',       // optional — promo format preference (bundle, festival, free shipping…)
  'keywords',              // optional — hashtags / SEO terms
  // strategy
  'competitors',           // optional — positioning context
  'customer_pain_points',  // optional — problems customers have that the brand solves
  'platforms',             // optional — comma-separated: line_oa,instagram,facebook,tiktok,shopee
  // visuals
  'visual_style',          // optional — aesthetic direction for image/video/media generation
  'color_palette',         // optional — brand colors for media generation
  'logo_url',              // optional — brand logo image URL (R2)
  'style_reference_urls',  // optional — JSON array of reference image URLs (R2)
  'style_reference_mode',  // optional — 'direct' (default) | 'extracted'
  'style_description',     // optional — cached AI-extracted style description from reference images
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
      'The field to save. Required: products, tone. Messaging: brand_name, usp, brand_voice_examples, do_not_say, promotion_style, keywords. Strategy: target_audience, price_range, competitors, customer_pain_points, platforms (comma-separated: line_oa,instagram,facebook,tiktok,shopee). Visuals: visual_style, color_palette, logo_url, style_reference_mode, style_description. Do NOT use this for style_reference_urls — use add_style_reference / remove_style_reference instead.',
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

// ── add_style_reference / remove_style_reference ──────────────────────────────

export const addStyleReferenceInputSchema = z.object({
  url: z
    .string()
    .url()
    .startsWith('https://')
    .describe('A confirmed https:// image URL (from user_attached_images context). Never invent or guess URLs.'),
});
export type AddStyleReferenceInput = z.infer<typeof addStyleReferenceInputSchema>;

export const removeStyleReferenceInputSchema = z.object({
  url: z.string().url().describe('The exact URL to remove from the style reference list.'),
});
export type RemoveStyleReferenceInput = z.infer<typeof removeStyleReferenceInputSchema>;

export const styleReferenceOutputSchema = z.object({
  urls: z.array(z.string()).describe('Current list of style reference image URLs after the operation'),
  count: z.number(),
});
export type StyleReferenceOutput = z.infer<typeof styleReferenceOutputSchema>;
