import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { userMemory } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const facts = await db
    .select()
    .from(userMemory)
    .where(eq(userMemory.userId, session.user.id))
    .orderBy(desc(userMemory.createdAt));

  return Response.json(facts);
}

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json() as { category: string; fact: string };
  if (!body.category || !body.fact) {
    return Response.json({ error: 'category and fact are required' }, { status: 400 });
  }

  const [fact] = await db
    .insert(userMemory)
    .values({
      id: nanoid(),
      userId: session.user.id,
      category: body.category,
      fact: body.fact.slice(0, 500),
    })
    .returning();

  return Response.json(fact, { status: 201 });
}

export async function DELETE() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await db.delete(userMemory).where(eq(userMemory.userId, session.user.id));
  return Response.json({ ok: true });
}
