import { requireSupportSession, updateSupportConversationMetadata } from '@/lib/support';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  const access = await requireSupportSession();
  if (!access.ok) {
    return access.response;
  }

  const { conversationId } = await params;
  const body = await req.json() as {
    assignedToUserId?: string | null;
    tags?: string[];
  };

  try {
    await updateSupportConversationMetadata({
      ownerUserId: access.value.ownerUserId,
      conversationId,
      assignedToUserId: typeof body.assignedToUserId === 'string' ? body.assignedToUserId : null,
      tags: Array.isArray(body.tags) ? body.tags.filter((tag): tag is string => typeof tag === 'string') : [],
    });

    return Response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message === 'Conversation not found' ? 404 : 400;
    return Response.json({ error: message }, { status });
  }
}
