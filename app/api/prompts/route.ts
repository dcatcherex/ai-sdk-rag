import { NextResponse } from 'next/server';
import { and, desc, eq, ne, or } from 'drizzle-orm';

import { requireUser } from "@/lib/auth-server";
import { db } from '@/lib/db';
import { promptLibrary } from '@/db/schema';
import { createPromptSchema } from '@/features/prompts/schema';
import { BUILT_IN_PROMPTS } from '@/features/prompts/constants';

export async function GET() {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;
  const userId = authResult.user.id;

  // Own prompts + public prompts from other users
  const dbPrompts = await db
    .select()
    .from(promptLibrary)
    .where(
      or(
        eq(promptLibrary.userId, userId),
        and(eq(promptLibrary.isPublic, true), ne(promptLibrary.userId, userId)),
      ),
    )
    .orderBy(desc(promptLibrary.updatedAt));

  // Merge built-ins (as virtual prompts, not stored in DB)
  const builtIns = BUILT_IN_PROMPTS.map((p) => ({
    ...p,
    userId: null,
    isPublic: true,
    isBuiltIn: true,
    usageCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }));

  const serialized = dbPrompts.map((p) => ({
    ...p,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  }));

  return NextResponse.json({ prompts: [...builtIns, ...serialized] });
}

export async function POST(req: Request) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;
  const result = createPromptSchema.safeParse(await req.json());
  if (!result.success) return NextResponse.json({ error: 'Bad Request' }, { status: 400 });
  const body = result.data;
  const now = new Date();

  const newPrompt = {
    id: crypto.randomUUID(),
    userId: authResult.user.id,
    title: body.title,
    content: body.content,
    category: body.category,
    tags: body.tags,
    isPublic: body.isPublic,
    isBuiltIn: false,
    usageCount: 0,
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(promptLibrary).values(newPrompt);

  return NextResponse.json({
    prompt: { ...newPrompt, createdAt: now.toISOString(), updatedAt: now.toISOString() },
  }, { status: 201 });
}
