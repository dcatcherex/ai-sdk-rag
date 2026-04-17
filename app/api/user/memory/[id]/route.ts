import { requireUser } from "@/lib/auth-server";
import { db } from '@/lib/db';
import { userMemory } from '@/db/schema';
import { and, eq } from 'drizzle-orm';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;
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
    .where(and(eq(userMemory.id, id), eq(userMemory.userId, authResult.user.id)))
    .returning();

  return Response.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;
  const { id } = await params;

  await db
    .delete(userMemory)
    .where(and(eq(userMemory.id, id), eq(userMemory.userId, authResult.user.id)));

  return Response.json({ ok: true });
}
