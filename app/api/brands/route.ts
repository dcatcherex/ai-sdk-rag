import { headers } from 'next/headers';

import { auth } from '@/lib/auth';
import { getBrands, createBrand } from '@/features/brands/service';

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const brands = await getBrands(session.user.id);
  return Response.json(brands);
}

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json() as Record<string, unknown>;
  if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
    return Response.json({ error: 'name is required' }, { status: 400 });
  }

  const created = await createBrand(session.user.id, body);
  return Response.json(created, { status: 201 });
}
