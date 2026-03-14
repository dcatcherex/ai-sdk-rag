import { headers } from 'next/headers';

import { auth } from '@/lib/auth';
import { importBrandFromJson } from '@/features/brands/service';
import type { BrandImportJson } from '@/features/brands/types';

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json() as BrandImportJson;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const created = await importBrandFromJson(session.user.id, body);
  return Response.json(created, { status: 201 });
}
