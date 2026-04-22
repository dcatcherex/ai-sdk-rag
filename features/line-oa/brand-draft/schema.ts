import { z } from 'zod';

export const LINE_BRAND_DRAFT_REQUIRED_FIELDS = ['products', 'tone'] as const;

export const getLineBrandDraftInputSchema = z.object({});
export type GetLineBrandDraftInput = z.infer<typeof getLineBrandDraftInputSchema>;

export const lineBrandDraftOutputSchema = z.object({
  fields: z.record(z.string(), z.string()),
  missingRequired: z.array(z.string()),
  isComplete: z.boolean(),
  styleReferenceUrls: z.array(z.string()),
  logoUrls: z.array(z.string()),
  styleDescription: z.string().nullable(),
  visualStyle: z.string().nullable(),
  colorPalette: z.string().nullable(),
});
export type LineBrandDraftOutput = z.infer<typeof lineBrandDraftOutputSchema>;

export const saveLineBrandDraftFieldInputSchema = z.object({
  field: z.string().min(1),
  value: z.string().min(1),
});
export type SaveLineBrandDraftFieldInput = z.infer<typeof saveLineBrandDraftFieldInputSchema>;

export const saveLineBrandDraftFieldOutputSchema = z.object({
  saved: z.boolean(),
  field: z.string(),
  value: z.string(),
  missingRequired: z.array(z.string()),
  isComplete: z.boolean(),
});
export type SaveLineBrandDraftFieldOutput = z.infer<typeof saveLineBrandDraftFieldOutputSchema>;

export const addLineBrandStyleReferenceInputSchema = z.object({
  url: z.string().url().startsWith('https://'),
});
export type AddLineBrandStyleReferenceInput = z.infer<typeof addLineBrandStyleReferenceInputSchema>;

export const removeLineBrandStyleReferenceInputSchema = z.object({
  url: z.string().url(),
});
export type RemoveLineBrandStyleReferenceInput = z.infer<typeof removeLineBrandStyleReferenceInputSchema>;

export const lineBrandStyleReferenceOutputSchema = z.object({
  urls: z.array(z.string()),
  count: z.number(),
});
export type LineBrandStyleReferenceOutput = z.infer<typeof lineBrandStyleReferenceOutputSchema>;
