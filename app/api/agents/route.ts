import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { agent } from '@/db/schema';

const createSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  systemPrompt: z.string().min(1),
  modelId: z.string().optional().nullable(),
  enabledTools: z.array(z.string()).optional(),
});

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const agents = await db
    .select()
    .from(agent)
    .where(eq(agent.userId, session.user.id))
    .orderBy(desc(agent.updatedAt));

  return NextResponse.json({ agents });
}

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = createSchema.parse(await req.json());
  const now = new Date();

  const newAgent = {
    id: crypto.randomUUID(),
    userId: session.user.id,
    name: body.name,
    description: body.description ?? null,
    systemPrompt: body.systemPrompt,
    modelId: body.modelId ?? null,
    enabledTools: body.enabledTools ?? [],
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(agent).values(newAgent);

  return NextResponse.json({ agent: newAgent }, { status: 201 });
}
