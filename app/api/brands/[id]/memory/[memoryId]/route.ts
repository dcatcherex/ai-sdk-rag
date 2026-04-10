import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { updateBrandMemorySchema } from "@/features/memory/schema";
import { deleteBrandMemory, updateBrandMemory } from "@/features/memory/service";

type Params = { params: Promise<{ id: string; memoryId: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

  const { id: brandId, memoryId } = await params;
  const body = await request.json();
  const parsed = updateBrandMemorySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const record = await updateBrandMemory(session.user.id, brandId, memoryId, parsed.data);
    return NextResponse.json(record);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "FORBIDDEN") return new NextResponse("Forbidden", { status: 403 });
      if (error.message === "NOT_FOUND") return new NextResponse("Not found", { status: 404 });
    }
    throw error;
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

  const { id: brandId, memoryId } = await params;

  try {
    await deleteBrandMemory(session.user.id, brandId, memoryId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "FORBIDDEN") return new NextResponse("Forbidden", { status: 403 });
      if (error.message === "NOT_FOUND") return new NextResponse("Not found", { status: 404 });
    }
    throw error;
  }
}
