import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { createBrandMemorySchema } from "@/features/memory/schema";
import { createBrandMemory, listBrandMemory } from "@/features/memory/service";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

  const { id: brandId } = await params;

  try {
    const payload = await listBrandMemory(session.user.id, brandId);
    return NextResponse.json(payload);
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return new NextResponse("Forbidden", { status: 403 });
    }
    throw error;
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

  const { id: brandId } = await params;
  const body = await request.json();
  const parsed = createBrandMemorySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const record = await createBrandMemory(session.user.id, brandId, parsed.data);
    return NextResponse.json(record, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return new NextResponse("Forbidden", { status: 403 });
    }
    throw error;
  }
}
