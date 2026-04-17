import { z } from 'zod';

import { requireUser } from "@/lib/auth-server";
import { getCampaignBriefs, createCampaignBrief } from '@/features/content-calendar/service';

const createSchema = z.object({
  title: z.string().min(1),
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

export async function GET(req: Request) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const url = new URL(req.url);
  const brandId = url.searchParams.get('brandId') ?? undefined;
  const status = url.searchParams.get('status') ?? undefined;

  const briefs = await getCampaignBriefs(authResult.user.id, { brandId, status });
  return Response.json(briefs);
}

export async function POST(req: Request) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const body = await req.json() as unknown;
  const result = createSchema.safeParse(body);
  if (!result.success) return new Response('Bad Request', { status: 400 });

  const brief = await createCampaignBrief(authResult.user.id, {
    ...result.data,
    brandId: result.data.brandId ?? null,
    goal: result.data.goal ?? null,
    offer: result.data.offer ?? null,
    keyMessage: result.data.keyMessage ?? null,
    cta: result.data.cta ?? null,
    startDate: result.data.startDate ?? null,
    endDate: result.data.endDate ?? null,
  });
  return Response.json(brief, { status: 201 });
}
