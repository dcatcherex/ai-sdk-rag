import { NextRequest, NextResponse } from "next/server";

import { requireUser } from "@/lib/auth-server";
import { refreshThreadWorkingMemory } from "@/features/memory/service";

type Params = { params: Promise<{ threadId: string }> };

export async function POST(_request: NextRequest, { params }: Params) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const { threadId } = await params;

  try {
    const record = await refreshThreadWorkingMemory(authResult.user.id, threadId);
    return NextResponse.json({ workingMemory: record });
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_FOUND") {
      return new NextResponse("Not found", { status: 404 });
    }
    throw error;
  }
}
