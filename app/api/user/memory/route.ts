import { requireUser } from "@/lib/auth-server";
import { db } from '@/lib/db';
import { userMemory } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';

export async function GET() {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;
  const facts = await db
    .select()
    .from(userMemory)
    .where(eq(userMemory.userId, authResult.user.id))
    .orderBy(desc(userMemory.createdAt));

  return Response.json(facts);
}

export async function POST(req: Request) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;
  const body = await req.json() as { category: string; fact: string };
  if (!body.category || !body.fact) {
    return Response.json({ error: 'category and fact are required' }, { status: 400 });
  }

  const [fact] = await db
    .insert(userMemory)
    .values({
      id: nanoid(),
      userId: authResult.user.id,
      category: body.category,
      fact: body.fact.slice(0, 500),
    })
    .returning();

  return Response.json(fact, { status: 201 });
}

export async function DELETE() {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;
  await db.delete(userMemory).where(eq(userMemory.userId, authResult.user.id));
  return Response.json({ ok: true });
}
