import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from "@/lib/auth-server";
import { updateGuardrail, deleteGuardrail } from '@/features/brand-guardrails/service';
import { updateGuardrailSchema } from '@/features/brand-guardrails/schema';
import { db } from '@/lib/db';
import { brand } from '@/db/schema';
import { eq } from 'drizzle-orm';

async function getBrandOwner(brandId: string): Promise<string | null> {
  const rows = await db.select({ userId: brand.userId }).from(brand).where(eq(brand.id, brandId)).limit(1);
  return rows.length > 0 ? rows[0].userId : null;
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; guardrailId: string }> },
) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const { id: brandId, guardrailId } = await params;

  const ownerId = await getBrandOwner(brandId);
  if (ownerId !== authResult.user.id) return new NextResponse('Forbidden', { status: 403 });

  const body = await req.json();
  const result = updateGuardrailSchema.safeParse(body);
  if (!result.success) return new NextResponse('Bad Request', { status: 400 });

  const updated = await updateGuardrail(brandId, guardrailId, result.data);
  if (!updated) return new NextResponse('Not Found', { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; guardrailId: string }> },
) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const { id: brandId, guardrailId } = await params;

  const ownerId = await getBrandOwner(brandId);
  if (ownerId !== authResult.user.id) return new NextResponse('Forbidden', { status: 403 });

  await deleteGuardrail(brandId, guardrailId);
  return new NextResponse(null, { status: 204 });
}
