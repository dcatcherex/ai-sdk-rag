import { headers } from 'next/headers';

import { auth } from '@/lib/auth';
import { getBrand, updateBrand, deleteBrand, setDefaultBrand } from '@/features/brands/service';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const b = await getBrand(session.user.id, id);
  if (!b) return Response.json({ error: 'Not found' }, { status: 404 });

  return Response.json(b);
}

export async function PATCH(req: Request, { params }: Params) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await req.json() as Record<string, unknown>;

  if (body._action === 'setDefault') {
    await setDefaultBrand(session.user.id, id);
    return Response.json({ ok: true });
  }

  const updated = await updateBrand(session.user.id, id, body);
  if (!updated) return Response.json({ error: 'Not found' }, { status: 404 });

  return Response.json(updated);
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  await deleteBrand(session.user.id, id);

  return new Response(null, { status: 204 });
}
