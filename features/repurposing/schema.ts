import { z } from 'zod';

export const repurposeFormatEnum = z.enum([
  'blog_post',
  'newsletter',
  'linkedin_post',
  'tweet_thread',
  'social_caption',
  'ad_copy',
  'email_sequence',
]);

export const repurposeInputSchema = z.object({
  sourceText: z.string().min(50).describe('The source content to repurpose (at least 50 characters)'),
  sourceTitle: z.string().optional().describe('Optional title of the source content'),
  targetFormats: z
    .array(repurposeFormatEnum)
    .min(1)
    .describe('List of formats to repurpose the content into'),
  brandContext: z.string().optional().describe('Brand voice, guidelines, or context to apply'),
  tone: z.string().optional().describe('Desired tone for the repurposed content'),
});

export type RepurposeInputSchema = z.infer<typeof repurposeInputSchema>;
