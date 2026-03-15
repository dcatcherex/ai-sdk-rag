import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { z } from 'zod';
import { updatePost } from '@/features/content-marketing/service';
import { socialPlatformSchema } from '@/features/content-marketing/schema';

const patchBody = z.object({
  caption: z.string().min(1).optional(),
  platforms: z.array(socialPlatformSchema).min(1).optional(),
  platformOverrides: z
    .record(socialPlatformSchema, z.object({ caption: z.string().optional() }))
    .optional(),
  scheduledAt: z.string().datetime().nullable().optional(),
  status: z.enum(['draft', 'scheduled', 'published', 'failed']).optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return new Response('Unauthorized', { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const result = patchBody.safeParse(body);
  if (!result.success) return new Response('Bad Request', { status: 400 });

  const { scheduledAt, ...rest } = result.data;

  const post = await updatePost({
    postId: id,
    userId: session.user.id,
    ...rest,
    ...(scheduledAt !== undefined
      ? { scheduledAt: scheduledAt ? new Date(scheduledAt) : null }
      : {}),
  });

  return Response.json({ post });
}
