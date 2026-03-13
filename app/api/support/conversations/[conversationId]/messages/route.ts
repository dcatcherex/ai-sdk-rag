import { listSupportMessages, requireSupportSession } from '@/lib/support';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  const access = await requireSupportSession();
  if (!access.ok) {
    return access.response;
  }

  const { conversationId } = await params;

  try {
    const messages = await listSupportMessages(access.value.ownerUserId, conversationId);
    return Response.json({ messages });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message === 'Conversation not found' ? 404 : 400;
    return Response.json({ error: message }, { status });
  }
}
