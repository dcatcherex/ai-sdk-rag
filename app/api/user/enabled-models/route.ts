import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { requireUser } from "@/lib/auth-server";
import { db } from "@/lib/db";
import { userModelPreference } from "@/db/schema";
import { availableModels } from "@/lib/ai";
import { getPlatformSettings } from "@/lib/platform-settings";

export async function GET() {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const [pref, settings] = await Promise.all([
    db
      .select()
      .from(userModelPreference)
      .where(eq(userModelPreference.userId, authResult.user.id))
      .then((rows) => rows[0]),
    getPlatformSettings(),
  ]);

  const allModelIds = availableModels.map((m) => m.id);
  const adminEnabledModelIds = settings.adminEnabledModelIds ?? allModelIds;

  // User can only have models that admin has enabled
  const userPref = pref?.enabledModelIds ?? adminEnabledModelIds;
  const enabledModelIds = userPref.filter((id) => adminEnabledModelIds.includes(id));

  return NextResponse.json({ enabledModelIds, adminEnabledModelIds });
}

export async function PUT(request: Request) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const body = (await request.json()) as { enabledModelIds: string[] };

  const settings = await getPlatformSettings();
  const allModelIds = availableModels.map((m) => m.id);
  const adminEnabledModelIds = settings.adminEnabledModelIds ?? allModelIds;

  // Only allow models that exist and admin has enabled
  const validIds = body.enabledModelIds.filter((id) => adminEnabledModelIds.includes(id));

  if (validIds.length === 0) {
    return NextResponse.json({ error: "At least one model must be enabled" }, { status: 400 });
  }

  await db
    .insert(userModelPreference)
    .values({ userId: authResult.user.id, enabledModelIds: validIds })
    .onConflictDoUpdate({
      target: userModelPreference.userId,
      set: { enabledModelIds: validIds },
    });

  return NextResponse.json({ enabledModelIds: validIds, adminEnabledModelIds });
}
