import { NextRequest, NextResponse } from "next/server";

import { requireUser } from "@/lib/auth-server";
import { archiveBrandMemory } from "@/features/memory/service";

type Params = { params: Promise<{ id: string; memoryId: string }> };

export async function POST(_request: NextRequest, { params }: Params) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const { id: brandId, memoryId } = await params;

  try {
    const record = await archiveBrandMemory(authResult.user.id, brandId, memoryId);
    return NextResponse.json(record);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "FORBIDDEN") return new NextResponse("Forbidden", { status: 403 });
      if (error.message === "NOT_FOUND") return new NextResponse("Not found", { status: 404 });
    }
    throw error;
  }
}
