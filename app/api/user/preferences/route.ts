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
      memoryInjectEnabled: true,
      memoryExtractEnabled: true,
      promptEnhancementEnabled: true,
      followUpSuggestionsEnabled: true,
      enabledToolIds: null,
      rerankEnabled: false,
      selectedVoice: null,
    });
  }

  return Response.json({
    memoryEnabled: prefs[0].memoryEnabled,
    memoryInjectEnabled: prefs[0].memoryInjectEnabled,
    memoryExtractEnabled: prefs[0].memoryExtractEnabled,
    promptEnhancementEnabled: prefs[0].promptEnhancementEnabled,
    followUpSuggestionsEnabled: prefs[0].followUpSuggestionsEnabled,
    enabledToolIds: prefs[0].enabledToolIds ?? null,
    rerankEnabled: prefs[0].rerankEnabled,
    selectedVoice: prefs[0].selectedVoice ?? null,
  });
}

export async function PUT(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json() as {
    memoryEnabled?: boolean;
    memoryInjectEnabled?: boolean;
    memoryExtractEnabled?: boolean;
    promptEnhancementEnabled?: boolean;
    followUpSuggestionsEnabled?: boolean;
    enabledToolIds?: string[] | null;
    rerankEnabled?: boolean;
    selectedVoice?: string | null;
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
      memoryInjectEnabled: body.memoryInjectEnabled ?? true,
      memoryExtractEnabled: body.memoryExtractEnabled ?? true,
      promptEnhancementEnabled: body.promptEnhancementEnabled ?? true,
      followUpSuggestionsEnabled: body.followUpSuggestionsEnabled ?? true,
      enabledToolIds: body.enabledToolIds ?? null,
      rerankEnabled: body.rerankEnabled ?? false,
      selectedVoice: body.selectedVoice ?? null,
    })
    .onConflictDoUpdate({
      target: userPreferences.userId,
      set: {
        ...(body.memoryEnabled !== undefined && { memoryEnabled: body.memoryEnabled }),
        ...(body.memoryInjectEnabled !== undefined && { memoryInjectEnabled: body.memoryInjectEnabled }),
        ...(body.memoryExtractEnabled !== undefined && { memoryExtractEnabled: body.memoryExtractEnabled }),
        ...(body.promptEnhancementEnabled !== undefined && { promptEnhancementEnabled: body.promptEnhancementEnabled }),
        ...(body.followUpSuggestionsEnabled !== undefined && { followUpSuggestionsEnabled: body.followUpSuggestionsEnabled }),
        ...(body.enabledToolIds !== undefined && { enabledToolIds: body.enabledToolIds }),
        ...(body.rerankEnabled !== undefined && { rerankEnabled: body.rerankEnabled }),
        ...(body.selectedVoice !== undefined && { selectedVoice: body.selectedVoice }),
        updatedAt: new Date(),
      },
    });

  return Response.json({ ok: true });
}
