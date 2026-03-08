import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { userMemory } from '@/db/schema';
import { and, eq } from 'drizzle-orm';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json() as { fact?: string; category?: string };

  const patch: Partial<{ fact: string; category: string }> = {};
  if (typeof body.fact === 'string') patch.fact = body.fact.slice(0, 500);
  if (typeof body.category === 'string') patch.category = body.category;

  if (Object.keys(patch).length === 0) {
    return Response.json({ error: 'Nothing to update' }, { status: 400 });
  }

  const [updated] = await db
    .update(userMemory)
    .set(patch)
    .where(and(eq(userMemory.id, id), eq(userMemory.userId, session.user.id)))
    .returning();

  return Response.json(updated);
}

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
