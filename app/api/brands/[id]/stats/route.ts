import { headers } from 'next/headers';
import { and, count, desc, eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { brand, chatThread } from '@/db/schema';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  // Verify brand belongs to user
  const brandRow = await db
    .select({ id: brand.id })
    .from(brand)
    .where(and(eq(brand.id, id), eq(brand.userId, session.user.id)))
    .limit(1);

  if (!brandRow.length) return Response.json({ error: 'Not found' }, { status: 404 });

  const [countResult, recentThreads] = await Promise.all([
    db
      .select({ total: count() })
      .from(chatThread)
      .where(and(eq(chatThread.brandId, id), eq(chatThread.userId, session.user.id))),
    db
      .select({ id: chatThread.id, title: chatThread.title, updatedAt: chatThread.updatedAt })
      .from(chatThread)
      .where(and(eq(chatThread.brandId, id), eq(chatThread.userId, session.user.id)))
      .orderBy(desc(chatThread.updatedAt))
      .limit(5),
  ]);

  return Response.json({
    threadCount: countResult[0]?.total ?? 0,
    recentThreads,
  });
}
