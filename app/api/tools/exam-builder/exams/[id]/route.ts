import { requireUser } from "@/lib/auth-server";
import { updateExamDraftInputSchema } from '@/features/exam-builder/schema';
import { getExamDraft, updateExamDraft, deleteExamDraft } from '@/features/exam-builder/service';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Params) {
  void req;
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const { id } = await params;
  const exam = await getExamDraft(id, authResult.user.id);
  if (!exam) return new Response('Not Found', { status: 404 });

  return Response.json(exam);
}

export async function PATCH(req: Request, { params }: Params) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const body = await req.json();
  const result = updateExamDraftInputSchema.safeParse(body);
  if (!result.success) return new Response('Bad Request', { status: 400 });

  const { id } = await params;
  const updated = await updateExamDraft(id, authResult.user.id, result.data);
  if (!updated) return new Response('Not Found', { status: 404 });

  return Response.json(updated);
}

export async function DELETE(req: Request, { params }: Params) {
  void req;
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const { id } = await params;
  await deleteExamDraft(id, authResult.user.id);
  return new Response(null, { status: 204 });
}
