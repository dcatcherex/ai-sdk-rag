
import { requireUser } from "@/lib/auth-server";
import { getKanbanEntries } from '@/features/content-calendar/service';

export async function GET(req: Request) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const url = new URL(req.url);
  const brandId = url.searchParams.get('brandId') ?? undefined;
  const campaignId = url.searchParams.get('campaignId') ?? undefined;

  const kanban = await getKanbanEntries(authResult.user.id, { brandId, campaignId });
  return Response.json(kanban);
}
