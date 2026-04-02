import { z } from 'zod';

const contentTypeEnum = z.enum([
  'blog_post',
  'newsletter',
  'email_sequence',
  'landing_page',
  'linkedin_post',
  'tweet_thread',
  'ad_copy',
]);

const contentStatusEnum = z.enum(['draft', 'published', 'archived']);

export const generateBlogPostSchema = z.object({
  topic: z.string().min(1).describe('The main topic or title of the blog post'),
  targetKeyword: z.string().optional().describe('Primary SEO keyword to optimize for'),
  tone: z.string().optional().describe('Writing tone, e.g. professional, casual, authoritative'),
  wordCount: z.number().int().min(200).max(5000).optional().default(800).describe('Target word count'),
  brandContext: z.string().optional().describe('Brand voice and context to apply'),
  outline: z.string().optional().describe('Optional content outline or key points to cover'),
});

export const generateNewsletterSchema = z.object({
  topic: z.string().min(1).describe('Main topic or theme of the newsletter'),
  audience: z.string().optional().describe('Target audience description'),
  tone: z.string().optional().describe('Writing tone'),
  brandContext: z.string().optional().describe('Brand voice and context'),
});

export const generateEmailSequenceSchema = z.object({
  goal: z.string().min(1).describe('The conversion goal of the sequence (e.g. onboard new users, sell product)'),
  product: z.string().optional().describe('Product or service being promoted'),
  sequenceLength: z.number().int().min(1).max(10).optional().default(3).describe('Number of emails in the sequence'),
  tone: z.string().optional().describe('Writing tone'),
  brandContext: z.string().optional().describe('Brand voice and context'),
});

export const generateLandingPageSchema = z.object({
  product: z.string().min(1).describe('Product or service to promote'),
  targetAudience: z.string().optional().describe('Target audience description'),
  keyBenefit: z.string().optional().describe('Primary value proposition or key benefit'),
  tone: z.string().optional().describe('Writing tone'),
  brandContext: z.string().optional().describe('Brand voice and context'),
});

export const createContentPieceSchema = z.object({
  brandId: z.string().optional(),
  contentType: contentTypeEnum,
  title: z.string().min(1),
  body: z.string().optional(),
  excerpt: z.string().optional(),
  status: contentStatusEnum.optional(),
  channel: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  parentId: z.string().optional(),
  generatedByTeamRunId: z.string().optional(),
});

export const updateContentPieceSchema = z.object({
  brandId: z.string().optional(),
  contentType: contentTypeEnum.optional(),
  title: z.string().min(1).optional(),
  body: z.string().optional(),
  excerpt: z.string().optional(),
  status: contentStatusEnum.optional(),
  channel: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  parentId: z.string().optional(),
});

export type CreateContentPieceInput = z.infer<typeof createContentPieceSchema>;
export type UpdateContentPieceInput = z.infer<typeof updateContentPieceSchema>;
