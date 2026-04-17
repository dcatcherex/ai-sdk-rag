
import { requireUser } from "@/lib/auth-server";
import { importBrandFromJson } from '@/features/brands/service';
import type { BrandImportJson } from '@/features/brands/types';

export async function POST(req: Request) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const body = await req.json() as BrandImportJson;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const created = await importBrandFromJson(authResult.user.id, body);
  return Response.json(created, { status: 201 });
}
