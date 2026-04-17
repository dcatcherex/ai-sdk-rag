import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from "@/lib/auth-server";
import { getBrand, updateBrandIcp, deleteBrandIcp } from '@/features/brands/service';
import { z } from 'zod';

async function getSessionUserId() {
  const user = await getCurrentUser();
  return user?.id ?? null;
}

const icpUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  ageRange: z.string().nullable().optional(),
  jobTitles: z.array(z.string()).optional(),
  painPoints: z.array(z.string()).optional(),
  buyingTriggers: z.array(z.string()).optional(),
  objections: z.array(z.string()).optional(),
  channels: z.array(z.string()).optional(),
  notes: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; icpId: string }> },
) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: brandId, icpId } = await params;
  const b = await getBrand(userId, brandId);
  if (!b || b.isOwner === false) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();
  const result = icpUpdateSchema.safeParse(body);
  if (!result.success) return NextResponse.json({ error: 'Bad request' }, { status: 400 });

  const updated = await updateBrandIcp(brandId, icpId, result.data);
  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; icpId: string }> },
) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: brandId, icpId } = await params;
  const b = await getBrand(userId, brandId);
  if (!b || b.isOwner === false) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  await deleteBrandIcp(brandId, icpId);
  return new NextResponse(null, { status: 204 });
}
