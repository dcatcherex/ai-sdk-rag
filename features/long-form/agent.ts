/**
 * Thin AI SDK adapter for long-form content generation tools.
 * All logic lives in service.ts — this file only wires up tool() definitions.
 */

import { tool } from 'ai';
import type { AgentToolContext } from '@/features/tools/registry/types';
import {
  generateBlogPostSchema,
  generateNewsletterSchema,
  generateEmailSequenceSchema,
  generateLandingPageSchema,
} from './schema';
import { z } from 'zod';
import {
  generateBlogPost,
  generateNewsletter,
  generateEmailSequence,
  generateLandingPage,
  createContentPiece,
  getUserContentPieces,
} from './service';
import type { ContentType, ContentStatus } from './types';

export function createLongFormAgentTools(ctx: Pick<AgentToolContext, 'userId'>) {
  const { userId } = ctx;

  return {
    generate_blog_post: tool({
      description:
        'Generate a full SEO-optimized blog post on a given topic. Saves the result automatically.',
      inputSchema: generateBlogPostSchema,
      async execute(input) {
        const generated = await generateBlogPost(input);
        const piece = await createContentPiece(userId, {
          contentType: 'blog_post',
          title: generated.title,
          body: generated.body,
          excerpt: generated.excerpt,
          status: 'draft',
        });
        return { success: true, piece };
      },
    }),

    generate_newsletter: tool({
      description:
        'Generate a newsletter with engaging sections and a clear call-to-action. Saves the result automatically.',
      inputSchema: generateNewsletterSchema,
      async execute(input) {
        const generated = await generateNewsletter(input);
        const piece = await createContentPiece(userId, {
          contentType: 'newsletter',
          title: generated.title,
          body: generated.body,
          excerpt: generated.excerpt,
          status: 'draft',
        });
        return { success: true, piece };
      },
    }),

    generate_email_sequence: tool({
      description:
        'Generate a multi-email sequence for a specific conversion goal. Saves the result automatically.',
      inputSchema: generateEmailSequenceSchema,
      async execute(input) {
        const generated = await generateEmailSequence(input);
        const piece = await createContentPiece(userId, {
          contentType: 'email_sequence',
          title: generated.title,
          body: generated.body,
          excerpt: generated.excerpt,
          status: 'draft',
        });
        return { success: true, piece };
      },
    }),

    generate_landing_page: tool({
      description:
        'Generate high-converting landing page copy including headline, benefits, and CTA sections. Saves the result automatically.',
      inputSchema: generateLandingPageSchema,
      async execute(input) {
        const generated = await generateLandingPage(input);
        const piece = await createContentPiece(userId, {
          contentType: 'landing_page',
          title: generated.title,
          body: generated.body,
          excerpt: generated.excerpt,
          status: 'draft',
        });
        return { success: true, piece };
      },
    }),

    list_content_pieces: tool({
      description: 'List the user\'s saved content pieces, with optional filters.',
      inputSchema: z.object({
        contentType: z
          .enum(['blog_post', 'newsletter', 'email_sequence', 'landing_page', 'linkedin_post', 'tweet_thread', 'ad_copy'])
          .optional()
          .describe('Filter by content type'),
        status: z
          .enum(['draft', 'published', 'archived'])
          .optional()
          .describe('Filter by status'),
        limit: z.number().int().min(1).max(50).optional().default(20),
      }),
      async execute(input) {
        const pieces = await getUserContentPieces(userId, {
          contentType: input.contentType as ContentType | undefined,
          status: input.status as ContentStatus | undefined,
          limit: input.limit,
        });
        return { success: true, pieces, count: pieces.length };
      },
    }),
  };
}
