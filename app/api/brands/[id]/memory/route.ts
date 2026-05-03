import { NextRequest, NextResponse } from "next/server";

import { requireUser } from "@/lib/auth-server";
import { createBrandMemorySchema } from "@/features/memory/schema";
import { createBrandMemory, listBrandMemory } from "@/features/memory/server/brand-memory";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const { id: brandId } = await params;

  try {
    const payload = await listBrandMemory(authResult.user.id, brandId);
    return NextResponse.json(payload);
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return new NextResponse("Forbidden", { status: 403 });
    }
    throw error;
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const { id: brandId } = await params;
  const body = await request.json();
  const parsed = createBrandMemorySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const record = await createBrandMemory(authResult.user.id, brandId, parsed.data);
    return NextResponse.json(record, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return new NextResponse("Forbidden", { status: 403 });
    }
    throw error;
  }
}
