import { z } from 'zod';

import { requireUser } from "@/lib/auth-server";
import { updateCalendarEntry } from '@/features/content-calendar/service';

const statusSchema = z.object({
  status: z.enum(['idea', 'briefed', 'drafting', 'review', 'approved', 'scheduled', 'published', 'repurposed']),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const body = await req.json() as unknown;
  const result = statusSchema.safeParse(body);
  if (!result.success) return new Response('Bad Request', { status: 400 });

  const { id } = await params;
  const updated = await updateCalendarEntry(authResult.user.id, id, { status: result.data.status });
  if (!updated) return new Response('Not Found', { status: 404 });
  return Response.json(updated);
}
