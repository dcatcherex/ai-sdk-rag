import { requireUser } from "@/lib/auth-server";
import { z } from 'zod';
import { updatePost } from '@/features/content-marketing/service';
import { socialPlatformSchema } from '@/features/content-marketing/schema';

const patchBody = z.object({
  caption: z.string().min(1).optional(),
  platforms: z.array(socialPlatformSchema).min(1).optional(),
  platformOverrides: z
    .record(z.string(), z.object({ caption: z.string().optional() }))
    .optional(),
  scheduledAt: z.string().datetime().nullable().optional(),
  status: z.enum(['draft', 'scheduled', 'published', 'failed']).optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const { id } = await params;
  const body = await req.json();
  const result = patchBody.safeParse(body);
  if (!result.success) return new Response('Bad Request', { status: 400 });

  const { scheduledAt, ...rest } = result.data;

  const post = await updatePost({
    postId: id,
    userId: authResult.user.id,
    ...rest,
    ...(scheduledAt !== undefined
      ? { scheduledAt: scheduledAt ? new Date(scheduledAt) : null }
      : {}),
  });

  return Response.json({ post });
}
