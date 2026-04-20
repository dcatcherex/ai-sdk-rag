import { and, asc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { chatMessage, chatThread, publicAgentShare } from '@/db/schema';

type Params = { params: Promise<{ token: string }> };

export async function GET(req: Request, { params }: Params) {
  const { token } = await params;
  const guestId = req.headers.get('x-guest-id');
  if (!guestId) return Response.json({ threadId: null, messages: [] });

  const [share] = await db
    .select({ isActive: publicAgentShare.isActive })
    .from(publicAgentShare)
    .where(eq(publicAgentShare.shareToken, token))
    .limit(1);

  if (!share?.isActive) return Response.json({ threadId: null, messages: [] });

  const [thread] = await db
    .select({ id: chatThread.id })
    .from(chatThread)
    .where(and(eq(chatThread.shareToken, token), eq(chatThread.guestId, guestId)))
    .limit(1);

  if (!thread) return Response.json({ threadId: null, messages: [] });

  const messages = await db
    .select({ id: chatMessage.id, role: chatMessage.role, parts: chatMessage.parts })
    .from(chatMessage)
    .where(eq(chatMessage.threadId, thread.id))
    .orderBy(asc(chatMessage.position));

  return Response.json({ threadId: thread.id, messages });
}
