/**
 * Thin AI SDK adapter for content-marketing tools.
 * All logic lives in service.ts — this file only wires up tool() definitions.
 */

import { tool } from 'ai';
import type { AgentToolContext } from '@/features/tools/registry/types';
import {
  generateCaptionsInputSchema,
  createDraftPostInputSchema,
  listPostsInputSchema,
} from './schema';
import { generateCaptions, createPost, getUserPosts } from './service';

export function createContentMarketingAgentTools(
  ctx: Pick<AgentToolContext, 'userId'>,
) {
  const { userId } = ctx;

  return {
    generate_post_captions: tool({
      description:
        'Generate AI-written social media captions for a given topic. Returns a base caption and per-platform variants optimized for Instagram, Facebook, or TikTok.',
      inputSchema: generateCaptionsInputSchema,
      async execute({ topic, platforms, tone, brandContext }) {
        const result = await generateCaptions({ topic, platforms, tone, brandContext });
        return { success: true, ...result };
      },
    }),

    create_social_post_draft: tool({
      description:
        'Save a social media post as a draft or schedule it for publishing. Returns the created post record.',
      inputSchema: createDraftPostInputSchema,
      async execute({ caption, platforms, platformOverrides, scheduledAt, brandId }) {
        const post = await createPost({
          userId,
          caption,
          platforms,
          platformOverrides,
          scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
          brandId,
        });
        return { success: true, post };
      },
    }),

    list_social_posts: tool({
      description: 'List the user\'s social media posts, optionally filtered by status.',
      inputSchema: listPostsInputSchema,
      async execute({ status }) {
        const posts = await getUserPosts(userId, status);
        return { success: true, posts, count: posts.length };
      },
    }),
  };
}
