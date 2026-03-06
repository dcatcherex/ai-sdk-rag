import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { userPreferences } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const prefs = await db
    .select()
    .from(userPreferences)
    .where(eq(userPreferences.userId, session.user.id))
    .limit(1);

  if (prefs.length === 0) {
    return Response.json({ memoryEnabled: true, promptEnhancementEnabled: true });
  }

  return Response.json({
    memoryEnabled: prefs[0].memoryEnabled,
    promptEnhancementEnabled: prefs[0].promptEnhancementEnabled,
  });
}

export async function PUT(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json() as { memoryEnabled?: boolean; promptEnhancementEnabled?: boolean };

  await db
    .insert(userPreferences)
    .values({
      userId: session.user.id,
      memoryEnabled: body.memoryEnabled ?? true,
      promptEnhancementEnabled: body.promptEnhancementEnabled ?? true,
    })
    .onConflictDoUpdate({
      target: userPreferences.userId,
      set: {
        ...(body.memoryEnabled !== undefined ? { memoryEnabled: body.memoryEnabled } : {}),
        ...(body.promptEnhancementEnabled !== undefined ? { promptEnhancementEnabled: body.promptEnhancementEnabled } : {}),
        updatedAt: new Date(),
      },
    });

  return Response.json({ ok: true });
}
