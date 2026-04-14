import { z } from 'zod';

export const createGoogleDocInputSchema = z.object({
  title: z.string().min(1).max(200),
  contentMarkdown: z.string().min(1),
  folderId: z.string().optional(),
});

export const createGoogleDocFromTemplateInputSchema = z.object({
  templateDocumentId: z.string().min(1),
  title: z.string().min(1).max(200),
  replacements: z.record(z.string(), z.string()),
  folderId: z.string().optional(),
});

export const appendGoogleDocSectionInputSchema = z.object({
  documentId: z.string().min(1),
  heading: z.string().min(1).max(200).optional(),
  contentMarkdown: z.string().min(1),
});

export type CreateGoogleDocInput = z.infer<typeof createGoogleDocInputSchema>;
export type CreateGoogleDocFromTemplateInput = z.infer<
  typeof createGoogleDocFromTemplateInputSchema
>;
export type AppendGoogleDocSectionInput = z.infer<
  typeof appendGoogleDocSectionInputSchema
>;
