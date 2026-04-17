import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from "@/lib/auth-server";
import { db } from '@/lib/db';
import { contentPiece, distributionRecord } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { createBroadcast, sendBroadcast } from '@/features/line-oa/broadcast/service';

const schema = z.object({
  contentPieceId: z.string().min(1),
  channelId: z.string().min(1),
});

/** Strip basic markdown to plain text for LINE */
function toPlainText(markdown: string): string {
  return markdown
    .replace(/#{1,6}\s+/g, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`{1,3}[^`]*`{1,3}/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^\s*[-*+]\s+/gm, '• ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export async function POST(req: Request) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const body = await req.json();
  const result = schema.safeParse(body);
  if (!result.success) return NextResponse.json({ error: 'Bad request' }, { status: 400 });

  const { contentPieceId, channelId } = result.data;
  const userId = authResult.user.id;

  // Load content piece (verify ownership)
  const [piece] = await db
    .select()
    .from(contentPiece)
    .where(and(eq(contentPiece.id, contentPieceId), eq(contentPiece.userId, userId)))
    .limit(1);

  if (!piece) return NextResponse.json({ error: 'Content piece not found' }, { status: 404 });

  // Build message text: prefer excerpt, fall back to first 1000 chars of body
  const rawText = piece.excerpt?.trim() || piece.body?.trim() || piece.title;
  const messageText = toPlainText(rawText ?? piece.title).slice(0, 2000);

  // Create broadcast draft and send immediately
  const broadcastName = `[Content] ${piece.title.slice(0, 60)}`;
  let broadcastId: string;
  let recipientCount: number | null = null;

  try {
    const broadcast = await createBroadcast(channelId, userId, {
      name: broadcastName,
      messageText,
    });
    broadcastId = broadcast.id;

    const sendResult = await sendBroadcast(broadcastId, userId);
    recipientCount = sendResult.recipientCount;
  } catch (err) {
    // Log a failed distribution record
    const failRecord = await db
      .insert(distributionRecord)
      .values({
        id: crypto.randomUUID(),
        userId,
        contentPieceId,
        channel: 'line_broadcast',
        status: 'failed',
        errorMessage: (err as Error).message,
        metadata: { channelId },
      })
      .returning();
    return NextResponse.json({ error: (err as Error).message, record: failRecord[0] }, { status: 500 });
  }

  // Log a successful distribution record
  const [record] = await db
    .insert(distributionRecord)
    .values({
      id: crypto.randomUUID(),
      userId,
      contentPieceId,
      channel: 'line_broadcast',
      status: 'sent',
      recipientCount,
      externalRef: broadcastId,
      sentAt: new Date(),
      metadata: { channelId },
    })
    .returning();

  return NextResponse.json(record, { status: 201 });
}
