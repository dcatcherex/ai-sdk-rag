import { headers } from 'next/headers';
import { z } from 'zod';

import { auth } from '@/lib/auth';
import { updateCalendarEntry } from '@/features/content-calendar/service';

const statusSchema = z.object({
  status: z.enum(['idea', 'briefed', 'drafting', 'review', 'approved', 'scheduled', 'published', 'repurposed']),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return new Response('Unauthorized', { status: 401 });

  const body = await req.json() as unknown;
  const result = statusSchema.safeParse(body);
  if (!result.success) return new Response('Bad Request', { status: 400 });

  const { id } = await params;
  const updated = await updateCalendarEntry(session.user.id, id, { status: result.data.status });
  if (!updated) return new Response('Not Found', { status: 404 });
  return Response.json(updated);
}
