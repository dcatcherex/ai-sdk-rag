import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { userModelPreference } from "@/db/schema";
import { availableModels } from "@/lib/ai";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [pref] = await db
    .select()
    .from(userModelPreference)
    .where(eq(userModelPreference.userId, session.user.id));

  const enabledModelIds = pref?.enabledModelIds ?? availableModels.map((m) => m.id);

  return NextResponse.json({ enabledModelIds });
}

export async function PUT(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { enabledModelIds: string[] };
  const validIds = body.enabledModelIds.filter((id) =>
    availableModels.some((m) => m.id === id)
  );

  if (validIds.length === 0) {
    return NextResponse.json({ error: "At least one model must be enabled" }, { status: 400 });
  }

  await db
    .insert(userModelPreference)
    .values({ userId: session.user.id, enabledModelIds: validIds })
    .onConflictDoUpdate({
      target: userModelPreference.userId,
      set: { enabledModelIds: validIds },
    });

  return NextResponse.json({ enabledModelIds: validIds });
}
