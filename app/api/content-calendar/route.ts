import { z } from 'zod';

import { requireUser } from "@/lib/auth-server";
import { getCalendarEntries, createCalendarEntry } from '@/features/content-calendar/service';

const createSchema = z.object({
  title: z.string().min(1),
  contentType: z.enum(['blog_post', 'newsletter', 'social', 'email', 'ad_copy', 'other']),
  plannedDate: z.string().min(1),
  brandId: z.string().nullish(),
  campaignId: z.string().nullish(),
  contentPieceId: z.string().nullish(),
  channel: z.enum(['instagram', 'facebook', 'linkedin', 'email', 'blog', 'other']).nullish(),
  status: z.enum(['idea', 'briefed', 'drafting', 'review', 'approved', 'scheduled', 'published', 'repurposed']).optional(),
  notes: z.string().nullish(),
  color: z.string().nullish(),
});

export async function GET(req: Request) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const url = new URL(req.url);
  const brandId = url.searchParams.get('brandId') ?? undefined;
  const campaignId = url.searchParams.get('campaignId') ?? undefined;
  const yearStr = url.searchParams.get('year');
  const monthStr = url.searchParams.get('month');
  const year = yearStr ? parseInt(yearStr, 10) : undefined;
  const month = monthStr ? parseInt(monthStr, 10) : undefined;

  const entries = await getCalendarEntries(authResult.user.id, { brandId, campaignId, year, month });
  return Response.json(entries);
}

export async function POST(req: Request) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const body = await req.json() as unknown;
  const result = createSchema.safeParse(body);
  if (!result.success) return new Response('Bad Request', { status: 400 });

  const entry = await createCalendarEntry(authResult.user.id, {
    ...result.data,
    brandId: result.data.brandId ?? null,
    campaignId: result.data.campaignId ?? null,
    contentPieceId: result.data.contentPieceId ?? null,
    channel: result.data.channel ?? null,
    notes: result.data.notes ?? null,
    color: result.data.color ?? null,
  });
  return Response.json(entry, { status: 201 });
}
