import { listSupportConversations, requireSupportSession } from '@/lib/support';

export async function GET(req: Request) {
  const access = await requireSupportSession();
  if (!access.ok) {
    return access.response;
  }

  const url = new URL(req.url);
  const search = url.searchParams.get('search') ?? '';
  const page = Math.max(1, Number(url.searchParams.get('page') ?? '1'));
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') ?? '20')));
  const offset = (page - 1) * limit;

  const result = await listSupportConversations({
    ownerUserId: access.value.ownerUserId,
    search,
    limit,
    offset,
  });

  return Response.json({
    conversations: result.items,
    total: result.total,
    page,
    totalPages: Math.max(1, Math.ceil(result.total / limit)),
  });
}
