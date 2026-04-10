import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { rejectBrandMemory } from "@/features/memory/service";

type Params = { params: Promise<{ id: string; memoryId: string }> };

export async function POST(_request: NextRequest, { params }: Params) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

  const { id: brandId, memoryId } = await params;

  try {
    const record = await rejectBrandMemory(session.user.id, brandId, memoryId);
    return NextResponse.json(record);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "FORBIDDEN") return new NextResponse("Forbidden", { status: 403 });
      if (error.message === "NOT_FOUND") return new NextResponse("Not found", { status: 404 });
    }
    throw error;
  }
}
