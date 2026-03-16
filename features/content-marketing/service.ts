/**
 * Canonical content-marketing business logic.
 * All callers (agent, API routes, sidebar) import from here.
 */

import { generateText } from 'ai';
import { nanoid } from 'nanoid';
import { eq, and, desc, lte } from 'drizzle-orm';
import { db } from '@/lib/db';
import { socialPost } from '@/db/schema';
import { getAccountsWithTokenByPlatform } from './social-account-service';
import type {
  SocialPlatform,
  PostStatus,
  PostMedia,
  PlatformOverrides,
  SocialPostRecord,
  GenerateCaptionsInput,
  GenerateCaptionsResult,
  CreatePostInput,
  UpdatePostInput,
  PublishPostInput,
  PublishResult,
} from './types';

const CONTENT_MODEL = 'google/gemini-2.5-flash-lite';

// ── Caption Generation ────────────────────────────────────────────────────────

const PLATFORM_GUIDELINES: Record<SocialPlatform, string> = {
  instagram: 'Instagram: up to 2200 chars, 3–5 hashtags, emoji-friendly, visual storytelling tone',
  facebook: 'Facebook: up to 63,000 chars, conversational, encourage discussion, limit hashtags to 1–2',
  tiktok: 'TikTok: up to 2200 chars, trendy, punchy hook in first line, relevant hashtags (3–8)',
};

export async function generateCaptions(
  input: GenerateCaptionsInput,
): Promise<GenerateCaptionsResult> {
  const { topic, platforms, tone = 'engaging', brandContext } = input;

  const platformGuides = platforms
    .map((p) => `- ${PLATFORM_GUIDELINES[p]}`)
    .join('\n');

  const brandSection = brandContext
    ? `\nBrand context:\n${brandContext}`
    : '';

  const prompt = `You are a social media copywriter. Write captions for the following topic.

Topic: ${topic}
Tone: ${tone}${brandSection}

Platform guidelines:
${platformGuides}

Return a JSON object with this exact structure:
{
  "base": "A general caption suitable for all platforms",
  "overrides": {
    ${platforms.map((p) => `"${p}": { "caption": "Platform-specific caption for ${p}" }`).join(',\n    ')}
  }
}

Rules:
- Each caption must follow its platform guidelines
- Include relevant hashtags per platform
- Keep captions authentic and on-brand
- Return ONLY the raw JSON object, no markdown, no code fences, no explanation`;

  const { text } = await generateText({
    model: CONTENT_MODEL,
    prompt,
  });

  try {
    const clean = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    const parsed = JSON.parse(clean) as GenerateCaptionsResult;
    return parsed;
  } catch {
    // Fallback: use raw text as base caption
    return {
      base: text.trim(),
      overrides: {},
    };
  }
}

// ── Post CRUD ─────────────────────────────────────────────────────────────────

export async function createPost(input: CreatePostInput): Promise<SocialPostRecord> {
  const {
    userId,
    caption,
    platforms,
    platformOverrides = {},
    media = [],
    scheduledAt,
    brandId,
  } = input;

  const id = nanoid();
  const status: PostStatus = scheduledAt ? 'scheduled' : 'draft';

  await db.insert(socialPost).values({
    id,
    userId,
    caption,
    platforms,
    platformOverrides,
    media,
    status,
    scheduledAt: scheduledAt ?? null,
    brandId: brandId ?? null,
  });

  return getPost(id, userId) as Promise<SocialPostRecord>;
}

export async function getPost(
  postId: string,
  userId: string,
): Promise<SocialPostRecord | null> {
  const rows = await db
    .select()
    .from(socialPost)
    .where(and(eq(socialPost.id, postId), eq(socialPost.userId, userId)))
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  return mapRow(row);
}

export async function getUserPosts(
  userId: string,
  status?: PostStatus | 'all',
): Promise<SocialPostRecord[]> {
  const query = db
    .select()
    .from(socialPost)
    .where(
      status && status !== 'all'
        ? and(eq(socialPost.userId, userId), eq(socialPost.status, status))
        : eq(socialPost.userId, userId),
    )
    .orderBy(desc(socialPost.createdAt));

  const rows = await query;
  return rows.map(mapRow);
}

export async function updatePost(input: UpdatePostInput): Promise<SocialPostRecord> {
  const { postId, userId, ...updates } = input;

  const updateData: Partial<typeof socialPost.$inferInsert> = {};
  if (updates.caption !== undefined) updateData.caption = updates.caption;
  if (updates.platforms !== undefined) updateData.platforms = updates.platforms;
  if (updates.platformOverrides !== undefined) updateData.platformOverrides = updates.platformOverrides;
  if (updates.media !== undefined) updateData.media = updates.media;
  if (updates.scheduledAt !== undefined) updateData.scheduledAt = updates.scheduledAt;
  if (updates.status !== undefined) updateData.status = updates.status;

  await db
    .update(socialPost)
    .set(updateData)
    .where(and(eq(socialPost.id, postId), eq(socialPost.userId, userId)));

  return getPost(postId, userId) as Promise<SocialPostRecord>;
}

export async function deletePost(postId: string, userId: string): Promise<void> {
  await db
    .delete(socialPost)
    .where(and(eq(socialPost.id, postId), eq(socialPost.userId, userId)));
}

// ── Publishing ────────────────────────────────────────────────────────────────

export async function publishPost(input: PublishPostInput): Promise<PublishResult[]> {
  const { postId, userId, platforms: limitToPlatforms } = input;

  const post = await getPost(postId, userId);
  if (!post) throw new Error('Post not found');
  if (post.status === 'published') throw new Error('Post is already published');

  const targetPlatforms = limitToPlatforms
    ? post.platforms.filter((p) => limitToPlatforms.includes(p))
    : post.platforms;

  const results: PublishResult[] = [];
  let anySuccess = false;
  const errors: string[] = [];

  for (const platform of targetPlatforms) {
    const result = await publishToPlatform(post, platform, userId);
    results.push(result);
    if (result.success) anySuccess = true;
    else if (result.error) errors.push(`${platform}: ${result.error}`);
  }

  // Update post status
  const newStatus: PostStatus = anySuccess ? 'published' : 'failed';
  await db
    .update(socialPost)
    .set({
      status: newStatus,
      publishedAt: anySuccess ? new Date() : null,
      error: errors.length > 0 ? errors.join('; ') : null,
    })
    .where(and(eq(socialPost.id, postId), eq(socialPost.userId, userId)));

  return results;
}

async function publishToPlatform(
  post: SocialPostRecord,
  platform: SocialPlatform,
  userId: string,
): Promise<PublishResult> {
  const accounts = await getAccountsWithTokenByPlatform(userId, platform);
  if (accounts.length === 0) {
    return { platform, success: false, error: `No connected ${platform} account` };
  }

  const account = accounts[0]!;
  const caption = post.platformOverrides[platform]?.caption ?? post.caption;
  const firstMedia = post.media[0];

  try {
    switch (platform) {
      case 'instagram':
        return await publishToInstagram(account.platformAccountId, account.accessToken, caption, firstMedia);
      case 'facebook':
        return await publishToFacebook(account.platformAccountId, account.accessToken, caption, firstMedia);
      case 'tiktok':
        return await publishToTikTok(account.platformAccountId, account.accessToken, caption, firstMedia);
    }
  } catch (err) {
    return { platform, success: false, error: (err as Error).message };
  }
}

async function publishToInstagram(
  igUserId: string,
  accessToken: string,
  caption: string,
  media?: PostMedia,
): Promise<PublishResult> {
  if (!media) {
    return { platform: 'instagram', success: false, error: 'Instagram requires an image' };
  }

  // Step 1: Create media container
  const containerRes = await fetch(
    `https://graph.facebook.com/${igUserId}/media`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_url: media.url, caption, access_token: accessToken }),
    },
  );

  if (!containerRes.ok) {
    const err = await containerRes.json() as { error?: { message?: string } };
    return { platform: 'instagram', success: false, error: err.error?.message ?? 'Container creation failed' };
  }

  const { id: creationId } = (await containerRes.json()) as { id: string };

  // Step 2: Publish the container
  const publishRes = await fetch(
    `https://graph.facebook.com/${igUserId}/media_publish`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ creation_id: creationId, access_token: accessToken }),
    },
  );

  if (!publishRes.ok) {
    const err = await publishRes.json() as { error?: { message?: string } };
    return { platform: 'instagram', success: false, error: err.error?.message ?? 'Publish failed' };
  }

  const { id: postId } = (await publishRes.json()) as { id: string };
  return { platform: 'instagram', success: true, platformPostId: postId };
}

async function publishToFacebook(
  pageId: string,
  pageAccessToken: string,
  message: string,
  media?: PostMedia,
): Promise<PublishResult> {
  let url: string;
  let body: Record<string, string>;

  if (media) {
    url = `https://graph.facebook.com/${pageId}/photos`;
    body = { url: media.url, message, access_token: pageAccessToken };
  } else {
    url = `https://graph.facebook.com/${pageId}/feed`;
    body = { message, access_token: pageAccessToken };
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json() as { error?: { message?: string } };
    return { platform: 'facebook', success: false, error: err.error?.message ?? 'Publish failed' };
  }

  const { id: postId } = (await res.json()) as { id: string };
  return { platform: 'facebook', success: true, platformPostId: postId };
}

async function publishToTikTok(
  openId: string,
  accessToken: string,
  caption: string,
  media?: PostMedia,
): Promise<PublishResult> {
  if (!media) {
    return { platform: 'tiktok', success: false, error: 'TikTok requires a video or image' };
  }

  // Use PULL_FROM_URL — TikTok fetches the media directly from the public R2 URL.
  // Supported for video; image posts require the Photo Post API (separate endpoint).
  const isVideo = media.mimeType.startsWith('video/');
  const endpoint = isVideo
    ? 'https://open.tiktokapis.com/v2/post/publish/video/init/'
    : 'https://open.tiktokapis.com/v2/post/publish/content/init/';

  const body = isVideo
    ? {
        post_info: {
          title: caption.slice(0, 2200),
          privacy_level: 'PUBLIC_TO_EVERYONE',
          disable_comment: false,
          disable_duet: false,
          disable_stitch: false,
        },
        source_info: { source: 'PULL_FROM_URL', video_url: media.url },
      }
    : {
        post_info: {
          title: caption.slice(0, 2200),
          privacy_level: 'PUBLIC_TO_EVERYONE',
          disable_comment: false,
        },
        source_info: { source: 'PULL_FROM_URL', photo_images: [media.url], photo_cover_index: 0 },
      };

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json() as { error?: { message?: string } };
    return { platform: 'tiktok', success: false, error: err.error?.message ?? 'TikTok publish failed' };
  }

  const data = (await res.json()) as { data: { publish_id: string } };
  // publish_id represents an async job — post will be processed by TikTok
  return { platform: 'tiktok', success: true, platformPostId: data.data.publish_id };
}

// ── Scheduled publishing ──────────────────────────────────────────────────────

export async function publishDuePosts(): Promise<{
  processed: number;
  results: Array<{ postId: string; platformResults: PublishResult[] }>;
}> {
  const now = new Date();

  // Find all posts due for publishing
  const duePosts = await db
    .select()
    .from(socialPost)
    .where(
      and(
        eq(socialPost.status, 'scheduled'),
        lte(socialPost.scheduledAt, now),
      ),
    );

  const results: Array<{ postId: string; platformResults: PublishResult[] }> = [];

  for (const post of duePosts) {
    try {
      const platformResults = await publishPost({
        postId: post.id,
        userId: post.userId,
      });
      results.push({ postId: post.id, platformResults });
    } catch (err) {
      // Mark as failed if publishPost itself throws
      await db
        .update(socialPost)
        .set({ status: 'failed', error: (err as Error).message })
        .where(eq(socialPost.id, post.id));
      results.push({
        postId: post.id,
        platformResults: [{ platform: 'instagram', success: false, error: (err as Error).message }],
      });
    }
  }

  return { processed: duePosts.length, results };
}

// ── Row mapper ────────────────────────────────────────────────────────────────

function mapRow(row: typeof socialPost.$inferSelect): SocialPostRecord {
  return {
    id: row.id,
    userId: row.userId,
    caption: row.caption,
    platforms: row.platforms as SocialPlatform[],
    platformOverrides: (row.platformOverrides ?? {}) as PlatformOverrides,
    media: (row.media ?? []) as PostMedia[],
    status: row.status as PostStatus,
    scheduledAt: row.scheduledAt,
    publishedAt: row.publishedAt,
    brandId: row.brandId,
    error: row.error,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
