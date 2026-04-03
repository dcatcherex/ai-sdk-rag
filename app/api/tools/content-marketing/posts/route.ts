import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { z } from 'zod';
import { createPost, getUserPosts, deletePost } from '@/features/content-marketing/service';
import { socialPlatformSchema } from '@/features/content-marketing/schema';

const createPostBody = z.object({
  caption: z.string().min(1),
  platforms: z.array(socialPlatformSchema).min(1),
  platformOverrides: z.record(z.string(), z.object({ caption: z.string().optional() })).optional(),
  media: z.array(z.object({
    r2Key: z.string(),
    url: z.string(),
    mimeType: z.string(),
    width: z.number().optional(),
    height: z.number().optional(),
    sizeBytes: z.number().optional(),
  })).optional(),
  scheduledAt: z.string().datetime().optional(),
  brandId: z.string().optional(),
  campaignId: z.string().optional(),
});

export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return new Response('Unauthorized', { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') ?? 'all';

  const posts = await getUserPosts(
    session.user.id,
    status as Parameters<typeof getUserPosts>[1],
  );

  return Response.json({ posts });
}

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return new Response('Unauthorized', { status: 401 });

  const body = await req.json();
  const result = createPostBody.safeParse(body);
  if (!result.success) {
    console.error('[POST /api/tools/content-marketing/posts] Validation error:', result.error.flatten());
    return new Response('Bad Request', { status: 400 });
  }

  const post = await createPost({
    userId: session.user.id,
    caption: result.data.caption,
    platforms: result.data.platforms,
    platformOverrides: result.data.platformOverrides,
    media: result.data.media,
    scheduledAt: result.data.scheduledAt ? new Date(result.data.scheduledAt) : undefined,
    brandId: result.data.brandId,
    campaignId: result.data.campaignId,
  });

  return Response.json({ post }, { status: 201 });
}

export async function DELETE(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return new Response('Unauthorized', { status: 401 });

  const { searchParams } = new URL(req.url);
  const postId = searchParams.get('id');
  if (!postId) return new Response('Missing id', { status: 400 });

  await deletePost(postId, session.user.id);
  return new Response(null, { status: 204 });
}
