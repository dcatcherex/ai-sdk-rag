import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { userPreferences } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { ALL_TOOL_IDS } from '@/lib/tool-registry';

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const prefs = await db
    .select()
    .from(userPreferences)
    .where(eq(userPreferences.userId, session.user.id))
    .limit(1);

  if (prefs.length === 0) {
    return Response.json({
      memoryEnabled: true,
      promptEnhancementEnabled: true,
      enabledToolIds: null, // null = all tools
    });
  }

  return Response.json({
    memoryEnabled: prefs[0].memoryEnabled,
    promptEnhancementEnabled: prefs[0].promptEnhancementEnabled,
    enabledToolIds: prefs[0].enabledToolIds ?? null,
  });
}

export async function PUT(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json() as {
    memoryEnabled?: boolean;
    promptEnhancementEnabled?: boolean;
    enabledToolIds?: string[] | null;
  };

  // Validate tool IDs if provided
  if (body.enabledToolIds !== undefined && body.enabledToolIds !== null) {
    const invalid = body.enabledToolIds.filter((id) => !ALL_TOOL_IDS.includes(id as never));
    if (invalid.length > 0) {
      return Response.json({ error: `Unknown tool IDs: ${invalid.join(', ')}` }, { status: 400 });
    }
  }

  await db
    .insert(userPreferences)
    .values({
      userId: session.user.id,
      memoryEnabled: body.memoryEnabled ?? true,
      promptEnhancementEnabled: body.promptEnhancementEnabled ?? true,
      enabledToolIds: body.enabledToolIds ?? null,
    })
    .onConflictDoUpdate({
      target: userPreferences.userId,
      set: {
        ...(body.memoryEnabled !== undefined && { memoryEnabled: body.memoryEnabled }),
        ...(body.promptEnhancementEnabled !== undefined && { promptEnhancementEnabled: body.promptEnhancementEnabled }),
        ...(body.enabledToolIds !== undefined && { enabledToolIds: body.enabledToolIds }),
        updatedAt: new Date(),
      },
    });

  return Response.json({ ok: true });
}
