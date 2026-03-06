import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { userMemory } from '@/db/schema';
import { and, eq } from 'drizzle-orm';

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  await db
    .delete(userMemory)
    .where(and(eq(userMemory.id, id), eq(userMemory.userId, session.user.id)));

  return Response.json({ ok: true });
}
