import { headers } from 'next/headers';

import { auth } from '@/lib/auth';
import { getKanbanEntries } from '@/features/content-calendar/service';

export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return new Response('Unauthorized', { status: 401 });

  const url = new URL(req.url);
  const brandId = url.searchParams.get('brandId') ?? undefined;
  const campaignId = url.searchParams.get('campaignId') ?? undefined;

  const kanban = await getKanbanEntries(session.user.id, { brandId, campaignId });
  return Response.json(kanban);
}
