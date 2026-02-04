import { headers } from 'next/headers';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { chatMessage } from '@/db/schema';

const reactionSchema = z.object({
  reaction: z.enum(['thumbs_up', 'thumbs_down']).nullable(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ messageId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { messageId } = await params;
    const body = await req.json();
    const { reaction } = reactionSchema.parse(body);

    // Update the message reaction
    await db
      .update(chatMessage)
      .set({ reaction })
      .where(eq(chatMessage.id, messageId));

    return Response.json({ success: true, reaction });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return Response.json({ error: message }, { status: 400 });
  }
}
