import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { customPersona } from '@/db/schema';
import { and, eq } from 'drizzle-orm';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const { name, systemPrompt } = await req.json() as { name?: string; systemPrompt?: string };

  const [updated] = await db
    .update(customPersona)
    .set({
      ...(name !== undefined && { name: name.trim().slice(0, 100) }),
      ...(systemPrompt !== undefined && { systemPrompt: systemPrompt.trim().slice(0, 4000) }),
    })
    .where(and(eq(customPersona.id, id), eq(customPersona.userId, session.user.id)))
    .returning();

  if (!updated) return Response.json({ error: 'Not found' }, { status: 404 });
  return Response.json(updated);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  await db
    .delete(customPersona)
    .where(and(eq(customPersona.id, id), eq(customPersona.userId, session.user.id)));

  return Response.json({ ok: true });
}
