import { z } from 'zod';

import { requireUser } from "@/lib/auth-server";
import {
  getCalendarEntries,
  updateCalendarEntry,
  deleteCalendarEntry,
} from '@/features/content-calendar/service';

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  contentType: z.enum(['blog_post', 'newsletter', 'social', 'email', 'ad_copy', 'other']).optional(),
  plannedDate: z.string().optional(),
  brandId: z.string().nullish(),
  campaignId: z.string().nullish(),
  contentPieceId: z.string().nullish(),
  channel: z.enum(['instagram', 'facebook', 'linkedin', 'email', 'blog', 'other']).nullish(),
  status: z.enum(['idea', 'briefed', 'drafting', 'review', 'approved', 'scheduled', 'published', 'repurposed']).optional(),
  notes: z.string().nullish(),
  color: z.string().nullish(),
});

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const { id } = await params;
  const entries = await getCalendarEntries(authResult.user.id);
  const entry = entries.find((e) => e.id === id);
  if (!entry) return new Response('Not Found', { status: 404 });
  return Response.json(entry);
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const body = await req.json() as unknown;
  const result = updateSchema.safeParse(body);
  if (!result.success) return new Response('Bad Request', { status: 400 });

  const { id } = await params;
  const updated = await updateCalendarEntry(authResult.user.id, id, {
    ...result.data,
    brandId: result.data.brandId ?? undefined,
    campaignId: result.data.campaignId ?? undefined,
    contentPieceId: result.data.contentPieceId ?? undefined,
    channel: result.data.channel ?? undefined,
    notes: result.data.notes ?? undefined,
    color: result.data.color ?? undefined,
  });
  if (!updated) return new Response('Not Found', { status: 404 });
  return Response.json(updated);
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const { id } = await params;
  await deleteCalendarEntry(authResult.user.id, id);
  return new Response(null, { status: 204 });
}
