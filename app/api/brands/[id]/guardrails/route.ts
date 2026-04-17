import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from "@/lib/auth-server";
import { getBrandGuardrails, createGuardrail } from '@/features/brand-guardrails/service';
import { createGuardrailSchema } from '@/features/brand-guardrails/schema';
import { db } from '@/lib/db';
import { brand } from '@/db/schema';
import { eq } from 'drizzle-orm';

async function getBrandOwner(brandId: string): Promise<string | null> {
  const rows = await db.select({ userId: brand.userId }).from(brand).where(eq(brand.id, brandId)).limit(1);
  return rows.length > 0 ? rows[0].userId : null;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const { id: brandId } = await params;
  const guardrails = await getBrandGuardrails(brandId);
  return NextResponse.json(guardrails);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const { id: brandId } = await params;

  // Only brand owner can create guardrails
  const ownerId = await getBrandOwner(brandId);
  if (ownerId !== authResult.user.id) return new NextResponse('Forbidden', { status: 403 });

  const body = await req.json();
  const result = createGuardrailSchema.safeParse(body);
  if (!result.success) return new NextResponse('Bad Request', { status: 400 });

  const guardrail = await createGuardrail(brandId, result.data);
  return NextResponse.json(guardrail, { status: 201 });
}
