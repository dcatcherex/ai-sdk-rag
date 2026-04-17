import { and, eq } from 'drizzle-orm';

import { requireUser } from "@/lib/auth-server";
import { db } from '@/lib/db';
import { brand } from '@/db/schema';
import { deleteBrandAsset } from '@/features/brands/service';

type Params = { params: Promise<{ id: string; assetId: string }> };

export async function DELETE(_req: Request, { params }: Params) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const { id, assetId } = await params;

  const [row] = await db
    .select({ id: brand.id })
    .from(brand)
    .where(and(eq(brand.id, id), eq(brand.userId, authResult.user.id)))
    .limit(1);

  if (!row) return Response.json({ error: 'Not found' }, { status: 404 });

  await deleteBrandAsset(id, assetId);
  return new Response(null, { status: 204 });
}
