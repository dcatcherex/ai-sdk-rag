import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { customPersona } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const personas = await db
    .select()
    .from(customPersona)
    .where(eq(customPersona.userId, session.user.id))
    .orderBy(customPersona.createdAt);

  return Response.json(personas);
}

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { name, systemPrompt } = await req.json() as { name: string; systemPrompt: string };
  if (!name?.trim()) return Response.json({ error: 'name is required' }, { status: 400 });
  if (!systemPrompt?.trim()) return Response.json({ error: 'systemPrompt is required' }, { status: 400 });

  const [created] = await db
    .insert(customPersona)
    .values({
      id: nanoid(),
      userId: session.user.id,
      name: name.trim().slice(0, 100),
      systemPrompt: systemPrompt.trim().slice(0, 4000),
    })
    .returning();

  return Response.json(created, { status: 201 });
}
