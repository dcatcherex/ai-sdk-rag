import { z } from 'zod';

import { requireUser } from "@/lib/auth-server";
import {
  getCampaignBrief,
  updateCampaignBrief,
  deleteCampaignBrief,
} from '@/features/content-calendar/service';

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  brandId: z.string().nullish(),
  goal: z.string().nullish(),
  offer: z.string().nullish(),
  keyMessage: z.string().nullish(),
  cta: z.string().nullish(),
  channels: z.array(z.string()).optional(),
  startDate: z.string().nullish(),
  endDate: z.string().nullish(),
  status: z.enum(['draft', 'active', 'completed', 'archived']).optional(),
});

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const { id } = await params;
  const brief = await getCampaignBrief(authResult.user.id, id);
  if (!brief) return new Response('Not Found', { status: 404 });
  return Response.json(brief);
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
  const updated = await updateCampaignBrief(authResult.user.id, id, {
    ...result.data,
    brandId: result.data.brandId ?? undefined,
    goal: result.data.goal ?? undefined,
    offer: result.data.offer ?? undefined,
    keyMessage: result.data.keyMessage ?? undefined,
    cta: result.data.cta ?? undefined,
    startDate: result.data.startDate ?? undefined,
    endDate: result.data.endDate ?? undefined,
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
  await deleteCampaignBrief(authResult.user.id, id);
  return new Response(null, { status: 204 });
}
