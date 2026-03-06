import { headers } from 'next/headers';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { chatMessage, chatThread } from '@/db/schema';
import { updateModelScore } from '@/lib/model-scores';

const reactionSchema = z.object({
  reaction: z.enum(['thumbs_up', 'thumbs_down']).nullable(),
});

export async function POST(req: Request, { params }: { params: Promise<{ messageId: string }> }) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { messageId } = await params;
    const { reaction } = reactionSchema.parse(await req.json());

    // Fetch message with ownership check via thread join
    const rows = await db
      .select({ id: chatMessage.id, reaction: chatMessage.reaction, metadata: chatMessage.metadata, userId: chatThread.userId })
      .from(chatMessage)
      .innerJoin(chatThread, eq(chatMessage.threadId, chatThread.id))
      .where(eq(chatMessage.id, messageId))
      .limit(1);

    if (rows.length === 0) return Response.json({ error: 'Message not found' }, { status: 404 });
    if (rows[0].userId !== session.user.id) return Response.json({ error: 'Forbidden' }, { status: 403 });

    const previousReaction = rows[0].reaction ?? null;

    await db.update(chatMessage).set({ reaction }).where(eq(chatMessage.id, messageId));

    // Fire-and-forget score update
    const metadata = rows[0].metadata as { routing?: { modelId?: string }; persona?: string } | null;
    const modelId = metadata?.routing?.modelId;
    const persona = metadata?.persona ?? 'general_assistant';
    if (modelId) void updateModelScore({ userId: session.user.id, modelId, persona, previousReaction, newReaction: reaction });

    return Response.json({ success: true, reaction });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 400 });
  }
}
