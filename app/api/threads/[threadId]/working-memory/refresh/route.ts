import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { refreshThreadWorkingMemory } from "@/features/memory/service";

type Params = { params: Promise<{ threadId: string }> };

export async function POST(_request: NextRequest, { params }: Params) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

  const { threadId } = await params;

  try {
    const record = await refreshThreadWorkingMemory(session.user.id, threadId);
    return NextResponse.json({ workingMemory: record });
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_FOUND") {
      return new NextResponse("Not found", { status: 404 });
    }
    throw error;
  }
}
