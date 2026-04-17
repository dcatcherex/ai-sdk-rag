
import { requireUser } from "@/lib/auth-server";
import { getBrands, createBrand } from '@/features/brands/service';

export async function GET() {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const brands = await getBrands(authResult.user.id);
  return Response.json(brands);
}

export async function POST(req: Request) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const body = await req.json() as Record<string, unknown>;
  if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
    return Response.json({ error: 'name is required' }, { status: 400 });
  }

  const created = await createBrand(authResult.user.id, body);
  return Response.json(created, { status: 201 });
}
