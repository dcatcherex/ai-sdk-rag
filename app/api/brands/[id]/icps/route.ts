import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from "@/lib/auth-server";
import { getBrand, getBrandIcps, createBrandIcp } from '@/features/brands/service';
import { z } from 'zod';

async function getSessionUserId() {
  const user = await getCurrentUser();
  return user?.id ?? null;
}

const icpSchema = z.object({
  name: z.string().min(1),
  ageRange: z.string().nullable().default(null),
  jobTitles: z.array(z.string()).default([]),
  painPoints: z.array(z.string()).default([]),
  buyingTriggers: z.array(z.string()).default([]),
  objections: z.array(z.string()).default([]),
  channels: z.array(z.string()).default([]),
  notes: z.string().nullable().default(null),
  sortOrder: z.number().int().default(0),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: brandId } = await params;
  const accessible = await getBrand(userId, brandId);
  if (!accessible) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const icps = await getBrandIcps(brandId);
  return NextResponse.json(icps);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: brandId } = await params;
  const b = await getBrand(userId, brandId);
  if (!b || b.isOwner === false) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();
  const result = icpSchema.safeParse(body);
  if (!result.success) return NextResponse.json({ error: 'Bad request' }, { status: 400 });

  const icp = await createBrandIcp(brandId, result.data);
  return NextResponse.json(icp, { status: 201 });
}
