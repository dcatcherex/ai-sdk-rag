import { headers } from 'next/headers';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { addBrandShare, getBrandShareList, removeBrandShare } from '@/features/brands/service';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const users = await getBrandShareList(session.user.id, id);
  return Response.json(users);
}

const addSchema = z.object({ userId: z.string().min(1) });

export async function POST(req: Request, { params }: Params) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const { userId } = addSchema.parse(await req.json());

  try {
    await addBrandShare(session.user.id, id, userId);
    return Response.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed';
    return Response.json({ error: msg }, { status: 400 });
  }
}

const removeSchema = z.object({ userId: z.string().min(1) });

export async function DELETE(req: Request, { params }: Params) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const { userId } = removeSchema.parse(await req.json());

  try {
    await removeBrandShare(session.user.id, id, userId);
    return Response.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed';
    return Response.json({ error: msg }, { status: 400 });
  }
}
