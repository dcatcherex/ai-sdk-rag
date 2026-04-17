import { z } from 'zod';
import { requireUser } from "@/lib/auth-server";
import { addBrandShare, getBrandShareList, removeBrandShare } from '@/features/brands/service';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const { id } = await params;
  const users = await getBrandShareList(authResult.user.id, id);
  return Response.json(users);
}

const addSchema = z.object({ userId: z.string().min(1) });

export async function POST(req: Request, { params }: Params) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const { id } = await params;
  const { userId } = addSchema.parse(await req.json());

  try {
    await addBrandShare(authResult.user.id, id, userId);
    return Response.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed';
    return Response.json({ error: msg }, { status: 400 });
  }
}

const removeSchema = z.object({ userId: z.string().min(1) });

export async function DELETE(req: Request, { params }: Params) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const { id } = await params;
  const { userId } = removeSchema.parse(await req.json());

  try {
    await removeBrandShare(authResult.user.id, id, userId);
    return Response.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed';
    return Response.json({ error: msg }, { status: 400 });
  }
}
