import { generateSupportReply, requireSupportSession, sendSupportReply } from '@/lib/support';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  const access = await requireSupportSession();
  if (!access.ok) {
    return access.response;
  }

  const { conversationId } = await params;
  const body = await req.json() as {
    text?: string;
    useAi?: boolean;
    draftOnly?: boolean;
  };

  try {
    if (body.useAi) {
      const aiReply = await generateSupportReply({
        ownerUserId: access.value.ownerUserId,
        conversationId,
      });

      if (body.draftOnly) {
        return Response.json({
          ok: true,
          text: aiReply.text,
          modelId: aiReply.modelId,
          draft: true,
        });
      }

      const sent = await sendSupportReply({
        ownerUserId: access.value.ownerUserId,
        conversationId,
        text: aiReply.text,
        senderType: 'ai',
        modelId: aiReply.modelId,
        payload: {
          mode: 'manual-ai',
          modelId: aiReply.modelId,
          requestedByUserId: access.value.session.user.id,
        },
      });

      return Response.json({
        ok: true,
        messageId: sent.messageId,
        text: sent.text,
        modelId: aiReply.modelId,
      });
    }

    if (!body.text?.trim()) {
      return Response.json({ error: 'Reply text is required' }, { status: 400 });
    }

    const sent = await sendSupportReply({
      ownerUserId: access.value.ownerUserId,
      conversationId,
      text: body.text,
      senderType: 'agent',
      payload: {
        mode: 'manual',
        requestedByUserId: access.value.session.user.id,
      },
    });

    return Response.json({
      ok: true,
      messageId: sent.messageId,
      text: sent.text,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message === 'Conversation not found' ? 404 : 400;
    return Response.json({ error: message }, { status });
  }
}
