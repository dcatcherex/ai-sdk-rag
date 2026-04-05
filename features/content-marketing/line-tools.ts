/**
 * AI SDK tool definitions for the LINE Content Creator agent.
 *
 * Call buildContentMarketingLineTools(userId) to get a tools object
 * ready to pass to generateText(). userId may be null for non-linked
 * LINE users — tools that require saving will return a helpful error.
 */

import { tool } from 'ai';
import { generateImage } from 'ai';
import { z } from 'zod';
import { uploadPublicObject } from '@/lib/r2';
import { generateCaptions, createPost, getUserPosts } from './service';

const LINE_IMAGE_MODEL = 'openai/gpt-image-1.5';

const platformsSchema = z.array(z.enum(['instagram', 'facebook', 'tiktok'])).min(1);

export function buildContentMarketingLineTools(userId: string | null) {
  return {
    /** Generate platform-optimised captions from a topic brief. */
    generate_caption: tool({
      description:
        'Generate social media captions for Instagram, Facebook, or TikTok from a topic or brief. ' +
        'Returns a base caption plus platform-specific versions with hashtags.',
      inputSchema: z.object({
        topic: z.string().describe('What the post is about — product, promotion, event, etc.'),
        platforms: platformsSchema.describe('Which platforms to generate for'),
        tone: z.string().optional().describe('Tone of voice, e.g. "fun and energetic" or "professional"'),
      }),
      execute: async ({ topic, platforms, tone }) => {
        const result = await generateCaptions({ topic, platforms, tone });
        return {
          base: result.base,
          overrides: result.overrides,
          message: `Generated captions for ${platforms.join(', ')}.`,
        };
      },
    }),

    /** Generate a marketing image and upload it to R2. Returns a public URL. */
    generate_image: tool({
      description:
        'Generate a marketing image for a social media post from a text description. ' +
        'Returns an image URL which will be sent to the user automatically.',
      inputSchema: z.object({
        prompt: z.string().describe('Detailed description of the image to generate'),
      }),
      execute: async ({ prompt }) => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const imageResult = await generateImage({ model: LINE_IMAGE_MODEL as any, prompt });
          const { base64, mediaType } = imageResult.image;
          const ext = mediaType.includes('png') ? 'png' : 'jpg';
          const key = `content-marketing/line/${crypto.randomUUID()}.${ext}`;
          const { url } = await uploadPublicObject({
            key,
            body: Buffer.from(base64, 'base64'),
            contentType: mediaType,
          });
          return { imageUrl: url, message: 'Image generated successfully.' };
        } catch (err) {
          return { imageUrl: null as string | null, message: `Image generation failed: ${(err as Error).message}` };
        }
      },
    }),

    /** Save a caption (and optional image) as a draft social post. */
    save_draft: tool({
      description:
        'Save a social media post draft to the content library. ' +
        'The user can later view, edit, schedule, and publish it from the web dashboard.',
      inputSchema: z.object({
        caption: z.string().describe('The caption text to save'),
        platforms: platformsSchema.describe('Which platforms this post is for'),
        imageUrl: z.string().url().optional().describe('Public image URL to attach to the post'),
        brandId: z.string().optional().describe('Brand to associate this post with'),
        scheduledAt: z
          .string()
          .datetime()
          .optional()
          .describe('ISO 8601 datetime to schedule the post; leave empty for draft'),
      }),
      execute: async ({ caption, platforms, imageUrl, brandId, scheduledAt }) => {
        if (!userId) {
          return {
            success: false,
            postId: null as string | null,
            message:
              'Your LINE account is not linked. ' +
              'Type /link TOKEN (get the token from Settings → LINE OA → Link Account) ' +
              'to connect your account, then I can save drafts for you.',
          };
        }
        const media = imageUrl ? [{ r2Key: '', url: imageUrl, mimeType: 'image/jpeg' }] : [];
        const post = await createPost({
          userId,
          caption,
          platforms,
          media,
          brandId,
          scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
        });
        return {
          success: true,
          postId: post.id,
          status: post.status,
          message: `Draft saved (ID: ${post.id.slice(0, 8)}). View it in Content Hub → Posts.`,
        };
      },
    }),

    /** List the user's recent draft social posts. */
    list_drafts: tool({
      description: 'List the most recent social media post drafts in the content library.',
      inputSchema: z.object({}),
      execute: async () => {
        if (!userId) {
          return {
            drafts: [] as Array<{ id: string; caption: string; platforms: string[]; hasImage: boolean; createdAt: string }>,
            message: 'Link your account first with /link TOKEN to see your drafts.',
          };
        }
        const posts = await getUserPosts(userId, 'draft');
        const drafts = posts.slice(0, 5).map((p) => ({
          id: p.id.slice(0, 8),
          caption: p.caption.slice(0, 100),
          platforms: p.platforms as string[],
          hasImage: p.media.length > 0,
          createdAt: p.createdAt.toISOString().slice(0, 10),
        }));
        return {
          drafts,
          message: drafts.length === 0 ? 'No drafts yet.' : `Found ${drafts.length} draft(s).`,
        };
      },
    }),
  };
}
