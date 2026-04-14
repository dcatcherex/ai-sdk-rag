import { z } from 'zod';

export const slideSchema = z.object({
  title: z.string().min(1),
  bullets: z.array(z.string()).max(6).default([]),
  speakerNotes: z.string().optional(),
  imagePrompt: z.string().optional(),
});

export const createGoogleSlidesDeckInputSchema = z.object({
  title: z.string().min(1).max(200),
  slides: z.array(slideSchema).min(1).max(30),
  folderId: z.string().optional(),
});

export const createGoogleSlidesFromTemplateInputSchema = z.object({
  templatePresentationId: z.string().min(1),
  title: z.string().min(1).max(200),
  slides: z.array(slideSchema).min(1).max(30),
  folderId: z.string().optional(),
});

export type GoogleSlidesSlideInput = z.infer<typeof slideSchema>;
export type CreateGoogleSlidesDeckInput = z.infer<typeof createGoogleSlidesDeckInputSchema>;
export type CreateGoogleSlidesFromTemplateInput = z.infer<
  typeof createGoogleSlidesFromTemplateInputSchema
>;
