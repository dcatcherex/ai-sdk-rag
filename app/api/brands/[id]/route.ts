
import { requireUser } from "@/lib/auth-server";
import { getBrand, updateBrand, deleteBrand, setDefaultBrand } from '@/features/brands/service';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const { id } = await params;
  const b = await getBrand(authResult.user.id, id);
  if (!b) return Response.json({ error: 'Not found' }, { status: 404 });

  return Response.json(b);
}

export async function PATCH(req: Request, { params }: Params) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const { id } = await params;
  const body = await req.json() as Record<string, unknown>;

  if (body._action === 'setDefault') {
    await setDefaultBrand(authResult.user.id, id);
    return Response.json({ ok: true });
  }

  const updated = await updateBrand(authResult.user.id, id, body);
  if (!updated) return Response.json({ error: 'Not found' }, { status: 404 });

  return Response.json(updated);
}

export async function DELETE(_req: Request, { params }: Params) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const { id } = await params;
  await deleteBrand(authResult.user.id, id);

  return new Response(null, { status: 204 });
}
