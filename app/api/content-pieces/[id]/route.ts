import { requireUser } from "@/lib/auth-server";
import {
  getContentPiece,
  updateContentPiece,
  deleteContentPiece,
} from '@/features/long-form/service';
import { updateContentPieceSchema } from '@/features/long-form/schema';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: RouteParams) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const { id } = await params;
  const piece = await getContentPiece(authResult.user.id, id);
  if (!piece) return Response.json({ error: 'Not found' }, { status: 404 });

  return Response.json(piece);
}

export async function PUT(req: Request, { params }: RouteParams) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const { id } = await params;
  const body = await req.json() as unknown;
  const result = updateContentPieceSchema.safeParse(body);
  if (!result.success) {
    return Response.json({ error: 'Bad Request', issues: result.error.issues }, { status: 400 });
  }

  const piece = await updateContentPiece(authResult.user.id, id, result.data);
  if (!piece) return Response.json({ error: 'Not found' }, { status: 404 });

  return Response.json(piece);
}

export async function DELETE(_req: Request, { params }: RouteParams) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const { id } = await params;
  await deleteContentPiece(authResult.user.id, id);
  return new Response(null, { status: 204 });
}
