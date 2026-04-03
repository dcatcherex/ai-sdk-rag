import { z } from 'zod';

export const socialPlatformSchema = z.enum(['instagram', 'facebook', 'tiktok']);

export const generateCaptionsInputSchema = z.object({
  topic: z.string().min(1).describe('The topic or theme for the post'),
  platforms: z
    .array(socialPlatformSchema)
    .min(1)
    .describe('Target platforms for the content'),
  tone: z
    .string()
    .optional()
    .describe('Tone of voice, e.g. "professional", "casual", "funny"'),
  brandContext: z
    .string()
    .optional()
    .describe('Brand context: name, values, target audience'),
  brandId: z
    .string()
    .optional()
    .describe('Brand ID — if provided, brand context is resolved server-side'),
});

export type GenerateCaptionsInput = z.infer<typeof generateCaptionsInputSchema>;

export const createDraftPostInputSchema = z.object({
  caption: z.string().min(1).describe('The post caption / body text'),
  platforms: z
    .array(socialPlatformSchema)
    .min(1)
    .describe('Platforms to publish to'),
  platformOverrides: z
    .record(socialPlatformSchema, z.object({ caption: z.string().optional() }))
    .optional()
    .describe('Per-platform caption overrides'),
  scheduledAt: z
    .string()
    .datetime()
    .optional()
    .describe('ISO 8601 datetime to schedule the post'),
  brandId: z.string().optional().describe('Brand ID to associate with this post'),
  campaignId: z.string().optional().describe('Campaign brief ID to link this post to'),
});

export type CreateDraftPostInput = z.infer<typeof createDraftPostInputSchema>;

export const listPostsInputSchema = z.object({
  status: z
    .enum(['draft', 'scheduled', 'published', 'failed', 'all'])
    .optional()
    .default('all')
    .describe('Filter by post status'),
});

export type ListPostsInput = z.infer<typeof listPostsInputSchema>;
