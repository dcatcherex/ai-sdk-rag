import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { z } from 'zod';
import { publishPost } from '@/features/content-marketing/service';
import { socialPlatformSchema } from '@/features/content-marketing/schema';

const publishBody = z.object({
  postId: z.string().min(1),
  platforms: z.array(socialPlatformSchema).optional(),
});

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return new Response('Unauthorized', { status: 401 });

  const body = await req.json();
  const result = publishBody.safeParse(body);
  if (!result.success) return new Response('Bad Request', { status: 400 });

  const results = await publishPost({
    postId: result.data.postId,
    userId: session.user.id,
    platforms: result.data.platforms,
  });

  const allSucceeded = results.every((r) => r.success);
  return Response.json({ results }, { status: allSucceeded ? 200 : 207 });
}
