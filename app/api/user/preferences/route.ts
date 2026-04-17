import { requireUser } from "@/lib/auth-server";
import { db } from '@/lib/db';
import { userPreferences } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { ALL_TOOL_IDS } from '@/lib/tool-registry';
import { WORKSPACE_ITEM_IDS } from '@/features/workspace/catalog';

export async function GET() {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const prefs = await db
    .select()
    .from(userPreferences)
    .where(eq(userPreferences.userId, authResult.user.id))
    .limit(1);

  if (prefs.length === 0) {
    return Response.json({
      memoryEnabled: true,
      memoryInjectEnabled: true,
      memoryExtractEnabled: true,
      promptEnhancementEnabled: true,
      followUpSuggestionsEnabled: true,
      enabledToolIds: null,
      pinnedWorkspaceItemIds: null,
      hiddenWorkspaceItemIds: null,
      rerankEnabled: false,
      selectedVoice: null,
      mcpCredentials: {},
    });
  }

  return Response.json({
    memoryEnabled: prefs[0].memoryEnabled,
    memoryInjectEnabled: prefs[0].memoryInjectEnabled,
    memoryExtractEnabled: prefs[0].memoryExtractEnabled,
    promptEnhancementEnabled: prefs[0].promptEnhancementEnabled,
    followUpSuggestionsEnabled: prefs[0].followUpSuggestionsEnabled,
    enabledToolIds: prefs[0].enabledToolIds ?? null,
    pinnedWorkspaceItemIds: prefs[0].pinnedWorkspaceItemIds ?? null,
    hiddenWorkspaceItemIds: prefs[0].hiddenWorkspaceItemIds ?? null,
    rerankEnabled: prefs[0].rerankEnabled,
    selectedVoice: prefs[0].selectedVoice ?? null,
    mcpCredentials: prefs[0].mcpCredentials ?? {},
  });
}

export async function PUT(req: Request) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const body = await req.json() as {
    memoryEnabled?: boolean;
    memoryInjectEnabled?: boolean;
    memoryExtractEnabled?: boolean;
    promptEnhancementEnabled?: boolean;
    followUpSuggestionsEnabled?: boolean;
    enabledToolIds?: string[] | null;
    pinnedWorkspaceItemIds?: string[] | null;
    hiddenWorkspaceItemIds?: string[] | null;
    rerankEnabled?: boolean;
    selectedVoice?: string | null;
    mcpCredentials?: Record<string, string>;
  };

  // Validate tool IDs if provided
  if (body.enabledToolIds !== undefined && body.enabledToolIds !== null) {
    const invalid = body.enabledToolIds.filter((id) => !ALL_TOOL_IDS.includes(id as never));
    if (invalid.length > 0) {
      return Response.json({ error: `Unknown tool IDs: ${invalid.join(', ')}` }, { status: 400 });
    }
  }

  if (body.pinnedWorkspaceItemIds !== undefined && body.pinnedWorkspaceItemIds !== null) {
    const invalid = body.pinnedWorkspaceItemIds.filter((id) => !WORKSPACE_ITEM_IDS.includes(id));
    if (invalid.length > 0) {
      return Response.json({ error: `Unknown workspace item IDs: ${invalid.join(', ')}` }, { status: 400 });
    }
  }

  if (body.hiddenWorkspaceItemIds !== undefined && body.hiddenWorkspaceItemIds !== null) {
    const invalid = body.hiddenWorkspaceItemIds.filter((id) => !WORKSPACE_ITEM_IDS.includes(id));
    if (invalid.length > 0) {
      return Response.json({ error: `Unknown workspace item IDs: ${invalid.join(', ')}` }, { status: 400 });
    }
  }

  await db
    .insert(userPreferences)
    .values({
      userId: authResult.user.id,
      memoryEnabled: body.memoryEnabled ?? true,
      memoryInjectEnabled: body.memoryInjectEnabled ?? true,
      memoryExtractEnabled: body.memoryExtractEnabled ?? true,
      promptEnhancementEnabled: body.promptEnhancementEnabled ?? true,
      followUpSuggestionsEnabled: body.followUpSuggestionsEnabled ?? true,
      enabledToolIds: body.enabledToolIds ?? null,
      pinnedWorkspaceItemIds: body.pinnedWorkspaceItemIds ?? null,
      hiddenWorkspaceItemIds: body.hiddenWorkspaceItemIds ?? null,
      rerankEnabled: body.rerankEnabled ?? false,
      selectedVoice: body.selectedVoice ?? null,
      mcpCredentials: body.mcpCredentials ?? {},
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
        ...(body.pinnedWorkspaceItemIds !== undefined && { pinnedWorkspaceItemIds: body.pinnedWorkspaceItemIds }),
        ...(body.hiddenWorkspaceItemIds !== undefined && { hiddenWorkspaceItemIds: body.hiddenWorkspaceItemIds }),
        ...(body.rerankEnabled !== undefined && { rerankEnabled: body.rerankEnabled }),
        ...(body.selectedVoice !== undefined && { selectedVoice: body.selectedVoice }),
        ...(body.mcpCredentials !== undefined && { mcpCredentials: body.mcpCredentials }),
        updatedAt: new Date(),
      },
    });

  return Response.json({ ok: true });
}
